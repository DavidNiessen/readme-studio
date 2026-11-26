import type { Release } from "../data/types";
import { ago, esc } from "../lib/escape";
import { card, fitText, svg, textWidth } from "../lib/svg";
import { n1 } from "./kit-c";
import { dl, emptyState, header, longDate, optNum, optPick, optStr } from "./kit-d";
import { balancedWrap, pkgNames, projectData, repoUrl } from "./kit-f";
import { onAccent } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;

type Bump = "major" | "minor" | "patch" | "pre" | "";

function semver(tag: string): [number, number, number, boolean] | null {
  const m = /^(?:[\w.-]*?[-@/])?v?(\d+)\.(\d+)(?:\.(\d+))?(-[\w.]+)?/.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0), !!m[4]] : null;
}

/** What kind of release a tag is, compared with the release before it. */
function bump(tag: string, prev: string | undefined): Bump {
  const a = semver(tag);
  if (!a) return "";
  if (a[3]) return "pre";
  const b = prev ? semver(prev) : null;
  if (!b) return a[1] === 0 && a[2] === 0 ? "major" : a[2] === 0 ? "minor" : "patch";
  if (a[0] !== b[0]) return "major";
  if (a[1] !== b[1]) return "minor";
  return "patch";
}

interface Entry {
  r: Release;
  bump: Bump;
  notes: string;
}

/** ISO timestamp if it parses, else "". */
function validIso(s: string | undefined): string {
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)) ? s : "";
}

function entries(ctx: Pick<Ctx, "data">, o: Record<string, unknown>): Entry[] {
  const pd = projectData(ctx);
  const all = [...(pd?.releases ?? [])].filter((r) => r && r.tag).sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const notes = pd?.releaseNotes ?? {};
  const only = optPick(o.only, ["all", "minor", "major"], "all");
  const list = all.map((r, i) => ({ r, bump: bump(r.tag, all[i + 1]?.tag), notes: String(notes[r.tag] || "").replace(/\s+/g, " ").trim() }));
  const keep = list.filter((e) => only === "all" || (only === "major" ? e.bump === "major" : e.bump === "major" || e.bump === "minor"));
  return keep.slice(0, optNum(o.count, 4, 1, 8));
}

export const pfChangelog = defineWidget({
  type: "changelog",
  title: "Changelog",
  description: "Your latest releases on a timeline: version pills, dates, a line or two of release notes and a pulsing marker on the newest one.",
  scope: "project",
  category: "Projects",
  kind: "svg",
  width: "full",
  needs: ["project", "releases"],
  defaults: { label: "changelog", count: 4, lines: "2", only: "all", kinds: true },
  fields: [
    { key: "label", label: "Title", type: "text", placeholder: "changelog" },
    { key: "count", label: "Releases", type: "number", min: 1, max: 8, step: 1 },
    {
      key: "lines",
      label: "Release notes",
      type: "segmented",
      options: [
        { value: "0", label: "None" },
        { value: "1", label: "1 line" },
        { value: "2", label: "2 lines" },
      ],
    },
    {
      key: "only",
      label: "Show",
      type: "segmented",
      options: [
        { value: "all", label: "Every release" },
        { value: "minor", label: "Major + minor" },
        { value: "major", label: "Major only" },
      ],
    },
    { key: "kinds", label: "Release kind tags", type: "toggle", help: "Marks each version as major, minor or patch." },
  ],
  alt: (ctx, o) => {
    const list = entries(ctx, o);
    const name = pkgNames(ctx).name;
    return list.length ? `${name} changelog: ${list.map((e) => e.r.tag).join(", ")}` : `${name} changelog`;
  },
  href: (ctx) => `${repoUrl(ctx)}/releases`,
  render(ctx, o) {
    const t = ctx.theme;
    const pd = projectData(ctx);
    const list = entries(ctx, o);
    const lbl = optStr(o.label);
    const nLines = Number(optPick(o.lines, ["0", "1", "2"], "2"));
    const kinds = o.kinds !== false;
    const top = lbl ? 56 : 26;
    const total = pd?.releases?.length ?? 0;
    const right = total ? `${total} release${total === 1 ? "" : "s"}${validIso(list[0]?.r.publishedAt) ? `  ·  last ${ago(list[0].r.publishedAt, ctx.date)}` : ""}` : "";

    if (!list.length) {
      const H = top + 132;
      const sub = total ? "No releases match this filter yet." : "Publish a GitHub release and it will appear here.";
      const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${emptyState(t, 24, top, W - 48, 104, "tag", "No releases yet", sub)}`;
      return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), body });
    }

    const dateX = 24;
    const dateOf = (e: Entry) => (validIso(e.r.publishedAt) ? longDate(e.r.publishedAt.slice(0, 10)) : "");
    const dateW = Math.max(60, ...list.map((e) => Math.max(textWidth(t, dateOf(e), 12.5, { bold: true }), validIso(e.r.publishedAt) ? textWidth(t, ago(e.r.publishedAt, ctx.date), 11.5) : 0)));
    const railX = Math.round(dateX + Math.min(dateW, 150) + 28);
    const cx = railX + 26;
    const textW = W - cx - 28;
    const noteFs = 13;
    const noteLh = 19;
    const rows: string[] = [];
    let y = top;
    const nodes: number[] = [];
    list.forEach((e, i) => {
      const latest = i === 0;
      const d = 0.2 + i * 0.12;
      const head = y + 14;
      nodes.push(head - 4);
      const iso = validIso(e.r.publishedAt);
      const date = iso ? longDate(iso.slice(0, 10)) : "";
      const rel = iso ? ago(iso, ctx.date) : "";
      // version pill
      const tag = fitText(t, e.r.tag, 12, 160, { bold: true });
      const pw = textWidth(t, tag, 12, { bold: true }) + 20;
      const pill = latest
        ? `<rect x="${cx}" y="${head - 15}" width="${n1(pw)}" height="22" rx="11" fill="${t.accent}"/><text x="${n1(cx + pw / 2)}" y="${head}" font-size="12" text-anchor="middle" class="b" fill="${onAccent(t)}">${esc(tag)}</text>`
        : `<rect x="${cx + 0.5}" y="${head - 14.5}" width="${n1(pw - 1)}" height="21" rx="10.5" fill="${t.raised}" stroke="${t.border}"/><text x="${n1(cx + pw / 2)}" y="${head}" font-size="12" text-anchor="middle" class="t b">${esc(tag)}</text>`;
      let x = cx + pw + 10;
      // latest chip
      let chips = "";
      if (latest) {
        const lw = textWidth(t, "LATEST", 9.5, { bold: true, letterSpacing: 1.2 }) + 26;
        chips += `<rect x="${n1(x + 0.5)}" y="${head - 13.5}" width="${n1(lw)}" height="19" rx="9.5" fill="${t.accent}" fill-opacity=".1" stroke="${t.accent}" stroke-opacity=".45"/>
<circle cx="${n1(x + 11)}" cy="${head - 4}" r="3" fill="${t.accent}"/><circle cx="${n1(x + 11)}" cy="${head - 4}" r="3" fill="${t.accent}" class="ping loop loop-only"/>
<text x="${n1(x + 19)}" y="${head - 0.5}" font-size="9.5" letter-spacing="1.2" class="a b">LATEST</text>`;
        x += lw + 10;
      }
      const kindTxt = kinds && e.bump ? e.bump.toUpperCase() : "";
      const kindW = kindTxt ? textWidth(t, kindTxt, 9.5, { bold: true, letterSpacing: 1.2 }) + 16 : 0;
      // release title, if it says more than the tag
      const title = (e.r.name || "").trim();
      const showTitle = title && title !== e.r.tag && title.replace(/^v/, "") !== e.r.tag.replace(/^v/, "");
      const titleMax = W - 28 - x - (kindW ? kindW + 12 : 0);
      const titleTxt = showTitle && titleMax > 40 ? fitText(t, title, 14, titleMax, { bold: true }) : "";
      const kind = kindTxt
        ? `<rect x="${n1(W - 28 - kindW + 0.5)}" y="${head - 13.5}" width="${n1(kindW - 1)}" height="18" rx="4" fill="none" stroke="${e.bump === "major" ? t.accent : t.border}"${e.bump === "patch" || e.bump === "pre" ? ' stroke-dasharray="3 2"' : ""}/><text x="${n1(W - 28 - kindW / 2)}" y="${head - 1}" font-size="9.5" text-anchor="middle" letter-spacing="1.2" class="${e.bump === "major" ? "a" : "m"} b">${kindTxt}</text>`
        : "";
      // notes
      const notes = nLines ? (e.notes ? balancedWrap(t, e.notes, noteFs, textW, nLines) : []) : [];
      const noteMarkup = notes
        .map((l, k) => `<text x="${cx}" y="${n1(head + 26 + k * noteLh)}" font-size="${noteFs}" class="m">${esc(l)}</text>`)
        .join("");
      const emptyNote = nLines && !notes.length ? `<text x="${cx}" y="${n1(head + 26)}" font-size="12" class="s">${esc("No release notes")}</text>` : "";
      const node = latest
        ? `<circle cx="${railX}" cy="${head - 4}" r="11" fill="${t.accent}" opacity=".25" class="fx ping2 loop loop-only"/><circle cx="${railX}" cy="${head - 4}" r="6.5" fill="${t.accent}"/><circle cx="${railX}" cy="${head - 4}" r="2.5" fill="${onAccent(t)}"/>`
        : `<circle cx="${railX}" cy="${head - 4}" r="5" fill="${t.card}" stroke="${e.bump === "major" ? t.accent : t.subtle}" stroke-width="2"/>`;
      rows.push(`<g class="in" style="${dl(d)}">
${date ? `<text x="${dateX}" y="${head}" font-size="12.5" class="t b">${esc(fitText(t, date, 12.5, 150, { bold: true }))}</text>` : ""}
${rel ? `<text x="${dateX}" y="${head + 18}" font-size="11.5" class="m">${esc(rel)}</text>` : ""}
${node}${pill}${chips}
${titleTxt ? `<text x="${n1(x)}" y="${head}" font-size="14" class="t b">${esc(titleTxt)}</text>` : ""}
${kind}
${noteMarkup}${emptyNote}
</g>`);
      const contentH = 26 + Math.max(nLines ? 1 : 0, notes.length) * noteLh;
      y += Math.max(44, contentH + 14) + (i < list.length - 1 ? 10 : 0);
      if (i < list.length - 1) rows.push(`<path d="M${cx} ${n1(y - 12.5)}H${W - 28}" stroke="${t.border}" class="fade" style="${dl(d + 0.2)}"/>`);
    });
    const H = y + 14;
    const rail =
      nodes.length > 1
        ? `<path d="M${railX} ${nodes[0]}V${nodes[nodes.length - 1]}" stroke="${t.border}" stroke-width="2" stroke-linecap="round"/><path d="M${railX} ${nodes[0]}V${nodes[nodes.length - 1]}" stroke="url(#railG)" stroke-width="2" stroke-linecap="round" class="rail"/>`
        : "";
    const css = `
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s cubic-bezier(0,0,.2,1) infinite}
@keyframes ping{0%{transform:scale(1);opacity:.8}75%,100%{transform:scale(2.6);opacity:0}}
.ping2{animation:ping2 2.4s ease-out 1.2s infinite}
@keyframes ping2{0%{transform:scale(.6);opacity:.6}100%{transform:scale(2);opacity:0}}
.rail{transform-box:fill-box;transform-origin:top;animation:grow 1.4s cubic-bezier(.2,.7,.2,1) .3s both}`;
    const defs = `<linearGradient id="railG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
${rail}
${rows.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
