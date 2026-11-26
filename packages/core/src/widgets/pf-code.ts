import { mix } from "../lib/color";
import { esc } from "../lib/escape";
import { card, cardStroke, fitText, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { mark, n1, pick, str } from "./kit-c";
import { fillStrict, lineSet, pkgNames, repoUrl, tint, xglyph } from "./kit-f";
import { detectLang, highlight, LANG_ICON, LANG_NAME, LANGS, type Lang, type Tok, type TokClass } from "./pf-highlight";
import { defineWidget } from "./types";

const W = 840;
const BAR = 40;
const FS = 13.5;
const LH = 22;
const MAX_ROWS = 36;

const DEFAULT_CODE = `import { createClient } from "{npm}";

const client = createClient({
  apiKey: process.env.API_KEY,
  retries: 3, // back off politely on 429s
});

const result = await client.run("hello, world");
console.log(result.output);`;

interface Row {
  /** 1-based source line, or 0 for a wrapped continuation */
  n: number;
  src: number;
  toks: Tok[];
  /** clipped with an ellipsis */
  cut: boolean;
}

/** Split tokens into visual rows no wider than max (wrap) or one clipped row per line. */
function layout(t: Theme, lines: Tok[][], max: number, wrap: boolean): Row[] {
  const tw = (s: string) => textWidth(t, s, FS);
  const rows: Row[] = [];
  const ell = tw("…");
  lines.forEach((toks, li) => {
    const total = toks.reduce((a, k) => a + tw(k.s), 0);
    if (total <= max) {
      rows.push({ n: li + 1, src: li + 1, toks, cut: false });
      return;
    }
    if (!wrap) {
      const out: Tok[] = [];
      let w = 0;
      for (const k of toks) {
        const kw = tw(k.s);
        if (w + kw <= max - ell) {
          out.push(k);
          w += kw;
          continue;
        }
        const s = fitText(t, k.s, FS, max - w);
        const body = s.endsWith("…") ? s.slice(0, -1) : s;
        if (body.trim()) out.push({ s: body, c: k.c });
        break;
      }
      rows.push({ n: li + 1, src: li + 1, toks: out, cut: true });
      return;
    }
    // wrap at whitespace; hard-break pieces that are wider than a row
    const lead = /^\s*/.exec(toks.map((k) => k.s).join(""))![0];
    const indent = `${lead}    `;
    const indentW = tw(indent);
    const pieces: Tok[] = toks.flatMap((k) => k.s.split(/(\s+)/).filter(Boolean).map((s) => ({ s, c: k.c })));
    let cur: Tok[] = [];
    let w = 0;
    let first = true;
    const flush = () => {
      while (cur.length && !cur[cur.length - 1].s.trim()) cur.pop();
      rows.push({ n: first ? li + 1 : 0, src: li + 1, toks: cur, cut: false });
      first = false;
      cur = [{ s: indent, c: "t" }];
      w = indentW;
    };
    for (const p of pieces) {
      let pw = tw(p.s);
      if (w + pw <= max) {
        cur.push(p);
        w += pw;
        continue;
      }
      if (!p.s.trim()) {
        flush();
        continue;
      }
      if (cur.some((k) => k.s.trim()) && pw <= max - indentW) {
        flush();
        cur.push(p);
        w += pw;
        continue;
      }
      // hard break a long piece
      let rest = p.s;
      while (rest) {
        const chars = [...rest];
        let k = chars.length;
        while (k > 1 && tw(chars.slice(0, k).join("")) > max - w) k--;
        const head = chars.slice(0, k).join("");
        cur.push({ s: head, c: p.c });
        rest = chars.slice(k).join("");
        if (rest) flush();
        else w += tw(head);
        pw = 0;
      }
    }
    if (cur.some((k) => k.s.trim())) flush();
  });
  return rows;
}

function palette(t: Theme): Record<TokClass, string> {
  const dark = t.name === "dark";
  return {
    t: t.text,
    kw: t.accent,
    str: t.accent2,
    num: t.glow,
    com: t.muted,
    fn: mix(t.text, t.glow, dark ? 0.35 : 0.4),
    ty: mix(t.accent2, t.text, dark ? 0.35 : 0.3),
    pun: mix(t.muted, t.text, 0.25),
    prop: mix(t.text, t.accent2, dark ? 0.22 : 0.3),
    var: t.glow,
  };
}

export const pfCode = defineWidget({
  type: "code",
  title: "Code snippet",
  description: "A syntax-highlighted code card with a file tab, line numbers, highlighted lines and a line-by-line reveal: perfect for a usage example.",
  scope: "project",
  category: "Content",
  kind: "svg",
  width: "full",
  defaults: {
    code: DEFAULT_CODE,
    language: "auto",
    filename: "example.ts",
    lineNumbers: true,
    highlight: "8",
    reveal: true,
    overflow: "wrap",
  },
  fields: [
    { key: "code", label: "Code", type: "text", multiline: true, max: 4000, help: "Placeholders: {npm} {pypi} {crate} {bin} {repo} {project} {version}. Up to 36 rows are shown." },
    { key: "language", label: "Language", type: "select", options: LANGS },
    { key: "filename", label: "File name", type: "text", placeholder: "example.ts", max: 60 },
    { key: "lineNumbers", label: "Line numbers", type: "toggle" },
    { key: "highlight", label: "Highlight lines", type: "text", placeholder: "3-5, 8", max: 40, help: "Line numbers or ranges to emphasise." },
    { key: "reveal", label: "Line-by-line reveal", type: "toggle" },
    {
      key: "overflow",
      label: "Long lines",
      type: "segmented",
      options: [
        { value: "wrap", label: "Wrap" },
        { value: "clip", label: "Clip" },
      ],
    },
  ],
  alt: (ctx, o) => {
    const file = str(o.filename);
    return `${file ? `${file}: ` : ""}code example for ${pkgNames(ctx).name}`;
  },
  href: (ctx) => repoUrl(ctx),
  render(ctx, o) {
    const t = ctx.theme;
    const raw = fillStrict(typeof o.code === "string" ? o.code : "", ctx).replace(/\r\n?/g, "\n").replace(/^\n+|\s+$/g, "");
    const file = fillStrict(str(o.filename), ctx);
    const langOpt = pick(o.language, ["auto", "ts", "python", "rust", "go", "shell", "json", "yaml", "plain"] as const, "auto");
    const lang: Lang = langOpt === "auto" ? detectLang(file, raw) : langOpt;
    const nums = o.lineNumbers !== false;
    const marks = lineSet(str(o.highlight));
    const reveal = o.reveal !== false && t.motion !== "off";
    const wrap = pick(o.overflow, ["wrap", "clip"] as const, "wrap") === "wrap";
    const pal = palette(t);

    const srcLines = raw ? highlight(raw, lang) : [];
    const lastNo = srcLines.length;
    const numW = nums ? textWidth(t, String(Math.max(10, lastNo)), 12.5) : 0;
    const gx = 24 + numW; // right edge of numbers
    const cx = nums ? gx + 22 : 28;
    const max = W - cx - 28;
    let rows = layout(t, srcLines, max, wrap);
    const more = rows.length > MAX_ROWS;
    if (more) rows = rows.slice(0, MAX_ROWS - 1);

    const top = BAR + 18;
    const bodyH = rows.length ? rows.length * LH + (more ? LH : 0) : 64;
    const H = top + bodyH + 16;

    // ------------------------------------------------ header tab
    const barFill = t.surface ? t.raised : "none";
    const tabFile = fitText(t, file || `snippet.${lang === "plain" ? "txt" : lang === "python" ? "py" : lang === "rust" ? "rs" : lang === "shell" ? "sh" : lang === "yaml" ? "yml" : lang}`, 12.5, 360, { bold: true });
    const tabW = 18 + 14 + 9 + textWidth(t, tabFile, 12.5, { bold: true }) + 20;
    const iconId = LANG_ICON[lang];
    const icon = mark(t, iconId, 18, BAR / 2 - 7, 14, "brand", t.card);
    const right = `${LANG_NAME[lang]}${raw ? `  ·  ${lastNo} line${lastNo === 1 ? "" : "s"}` : ""}`;
    const header = `<rect x="0" y="0" width="${W}" height="${BAR}" fill="${barFill}"/>
<path d="M0 ${BAR - 0.5}H${W}" stroke="${t.border}"/>
<rect x="0" y="0" width="${n1(tabW)}" height="${BAR}" fill="${t.surface ? t.card : "none"}"/>
<path d="M${n1(tabW + 0.5)} 0V${BAR}" stroke="${t.border}"/>
<rect x="0" y="0" width="${n1(tabW)}" height="2" fill="${t.accent}" class="bar"/>`;
    const headerText = `<g class="fade">${icon}<text x="${18 + 14 + 9}" y="${BAR / 2 + 4.5}" font-size="12.5" class="t b">${esc(tabFile)}</text>
<text x="${W - 50}" y="${BAR / 2 + 4}" font-size="11" text-anchor="end" letter-spacing=".4" class="m">${esc(right)}</text>
${xglyph("copy", W - 36, BAR / 2 - 7, 14, t.muted)}</g>`;

    // ------------------------------------------------ rows
    const step = rows.length > 18 ? 0.035 : 0.055;
    const d0 = 0.25;
    const out: string[] = [];
    const bands: string[] = [];
    rows.forEach((r, i) => {
      const y = top + i * LH;
      const base = y + 15.5;
      const hot = marks.has(r.src);
      const d = d0 + i * step;
      if (hot) {
        const prevHot = i > 0 && marks.has(rows[i - 1].src);
        const nextHot = i < rows.length - 1 && marks.has(rows[i + 1].src);
        bands.push(
          `<rect x="0" y="${y}" width="${W}" height="${LH}" fill="${tint(t, t.accent, t.name === "dark" ? 0.13 : 0.08)}" class="hl" style="animation-delay:${(d0 + rows.length * step + 0.1).toFixed(2)}s"/><rect x="0" y="${y + (prevHot ? 0 : 2)}" width="3" height="${LH - (prevHot ? 0 : 2) - (nextHot ? 0 : 2)}" fill="${t.accent}" class="fade" style="animation-delay:${(d0 + rows.length * step + 0.1).toFixed(2)}s"/>`,
        );
      }
      const numMarkup = nums && r.n ? `<text x="${n1(gx)}" y="${base}" font-size="12.5" text-anchor="end" fill="${hot ? t.accent : t.subtle}"${hot ? ' class="b"' : ""}>${r.n}</text>` : "";
      const spans = r.toks.map((k) => `<tspan fill="${pal[k.c]}">${esc(k.s)}</tspan>`).join("");
      const ell = r.cut ? `<tspan fill="${t.muted}">…</tspan>` : "";
      const code = r.toks.length || r.cut ? `<text x="${n1(cx)}" y="${base}" font-size="${FS}" xml:space="preserve">${spans}${ell}</text>` : "";
      if (!numMarkup && !code) return;
      out.push(`<g${reveal ? ` class="ln" style="animation-delay:${d.toFixed(2)}s"` : ""}>${numMarkup}${code}</g>`);
    });
    if (more) {
      const y = top + rows.length * LH + 15.5;
      out.push(`<text x="${n1(cx)}" y="${y}" font-size="12" class="m fade" style="animation-delay:${(d0 + rows.length * step).toFixed(2)}s">${esc(`… ${srcLines.length - (rows[rows.length - 1]?.src ?? 0)} more lines`)}</text>`);
    }

    // caret after the last row
    let caret = "";
    if (rows.length && !more) {
      const last = rows[rows.length - 1];
      const lw = last.toks.reduce((a, k) => a + textWidth(t, k.s, FS), 0);
      const y = top + (rows.length - 1) * LH;
      if (cx + lw + 12 < W - 20)
        caret = `<rect x="${n1(cx + lw + 3)}" y="${y + 3.5}" width="2" height="${FS + 2}" fill="${t.accent}" class="caret loop"/>`;
    }

    const empty = !rows.length
      ? `<text x="${W / 2}" y="${top + 38}" font-size="13" text-anchor="middle" class="m in">${esc("Paste a usage example in the inspector")}</text>`
      : "";

    const css = `
.ln{animation:lnIn .55s cubic-bezier(.2,.7,.2,1) both}
@keyframes lnIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
.hl{transform-box:fill-box;transform-origin:left;animation:growX .7s cubic-bezier(.2,.7,.2,1) both}
.bar{transform-box:fill-box;transform-origin:left;animation:growX .8s cubic-bezier(.2,.7,.2,1) .1s both}
.caret{animation:fadeIn .3s ease ${(d0 + rows.length * step + 0.2).toFixed(2)}s both,blink 1.1s step-end ${(d0 + rows.length * step + 0.5).toFixed(2)}s infinite}`;
    const defs = `<clipPath id="win"><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${t.radius}"/></clipPath>`;
    const body = `${card(t, { width: W, height: H })}
<g clip-path="url(#win)">${header}${bands.join("")}</g>
${cardStroke(t, W, H)}
${headerText}
${out.join("\n")}
${caret}${empty}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
