import { ago, esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { card, fitText, svg, textWidth, wrapText } from "../lib/svg";
import { TNUM, dl, emptyState, header, optBool, optList, optNum, optPick, optStr } from "./kit-d";
import { glyph } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;

interface Row {
  name: string;
  description: string;
  stars: number;
  forks: number | null;
  language: { name: string; color: string } | null;
  pushedAt: string;
}

type Sort = "stars" | "pushed";

function rows(ctx: Pick<Ctx, "data" | "profile">, o: Record<string, unknown>): Row[] {
  const source = optPick(o.source, ["repos", "pinned"], "repos");
  const sort = optPick<Sort>(o.sort, ["stars", "pushed"], "stars");
  const hide = new Set(optList(o.exclude).map((s) => s.toLowerCase()));
  if (optBool(o.hideProfile, true)) hide.add(ctx.profile.login.toLowerCase());
  const pushed = new Map((ctx.data.repos ?? []).map((r) => [r.name, r.pushedAt]));
  const list: Row[] =
    source === "pinned"
      ? (ctx.data.projects ?? []).map((p) => ({ name: p.name, description: p.description, stars: p.stars, forks: p.forks, language: p.language, pushedAt: pushed.get(p.name) ?? "" }))
      : (ctx.data.repos ?? []).map((r) => ({ name: r.name, description: r.description, stars: r.stars, forks: null, language: r.language, pushedAt: r.pushedAt }));
  const kept = list.filter((r) => r.name && !hide.has(r.name.toLowerCase()));
  if (sort === "pushed") kept.sort((a, b) => (b.pushedAt || "").localeCompare(a.pushedAt || ""));
  else kept.sort((a, b) => b.stars - a.stars || (b.pushedAt || "").localeCompare(a.pushedAt || ""));
  return kept.slice(0, optNum(o.count, 5, 1, 8));
}

/** "● TypeScript · 2 d ago" with a real colour dot; returns markup anchored at the right edge. */
function meta(ctx: Ctx, r: Row, xRight: number, y: number, showTime: boolean): { svg: string; w: number } {
  const t = ctx.theme;
  const parts: string[] = [];
  const time = showTime && r.pushedAt ? `pushed ${ago(r.pushedAt, ctx.date)}` : "";
  const lang = r.language?.name ?? "";
  const text = [lang, time].filter(Boolean).join(" · ");
  if (!text) return { svg: "", w: 0 };
  const tw = textWidth(t, text, 11);
  const dot = lang ? 12 : 0;
  parts.push(`<text x="${xRight}" y="${y}" font-size="11" text-anchor="end" class="m">${esc(text)}</text>`);
  if (lang) parts.push(`<circle cx="${(xRight - tw - 8).toFixed(1)}" cy="${y - 3.8}" r="4" fill="${r.language!.color || t.subtle}" stroke="${t.border}" stroke-width=".5"/>`);
  return { svg: parts.join(""), w: tw + dot };
}

/** Star glyph + rolling count, right aligned. */
function stars(ctx: Ctx, n: number, xRight: number, y: number, delay: number, size = 14): { svg: string; w: number } {
  const t = ctx.theme;
  const v = groupDigits(n);
  const vw = odometerWidth(t, v, size, true);
  const x0 = xRight - vw;
  return {
    w: vw + 20,
    svg: `${glyph("star", x0 - 19, y - size * 0.86, 14, t.accent)}<g class="tn">${odometer(t, v, { x: x0, y, fontSize: size, delay, duration: 1.6 })}</g>`,
  };
}

export const repos = defineWidget({
  type: "repos",
  title: "Top repositories",
  description: "Your best or most recently pushed repositories with descriptions, languages and rolling star counters.",
  scope: "profile",
  category: "Projects",
  kind: "svg",
  width: "full",
  needs: ["repos"],
  defaults: {
    label: "top repositories",
    source: "repos",
    sort: "stars",
    count: 5,
    layout: "list",
    descriptions: true,
    exclude: [],
    hideProfile: true,
  },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "source",
      label: "Source",
      type: "segmented",
      options: [
        { value: "repos", label: "All repositories" },
        { value: "pinned", label: "Pinned" },
      ],
    },
    {
      key: "sort",
      label: "Sort by",
      type: "segmented",
      options: [
        { value: "stars", label: "Stars" },
        { value: "pushed", label: "Recently pushed" },
      ],
    },
    { key: "count", label: "Repositories", type: "number", min: 1, max: 8, step: 1 },
    {
      key: "layout",
      label: "Layout",
      type: "segmented",
      options: [
        { value: "list", label: "List" },
        { value: "grid", label: "Two columns" },
      ],
    },
    { key: "descriptions", label: "Descriptions", type: "toggle" },
    { key: "exclude", label: "Hide repositories", type: "tags", placeholder: "repo-name", max: 20 },
    { key: "hideProfile", label: "Hide profile README repo", type: "toggle", help: "Skips the repository named after your username." },
  ],
  alt: (ctx, o) => `${o.sort === "pushed" ? "Recently pushed" : "Top"} repositories of ${ctx.profile.login}`,
  href: (ctx, o) => `https://github.com/${ctx.profile.login}?tab=repositories${o.sort === "pushed" ? "" : "&sort=stargazers"}`,
  render(ctx, o) {
    const t = ctx.theme;
    const list = rows(ctx, o);
    const sort = optPick<Sort>(o.sort, ["stars", "pushed"], "stars");
    const grid = o.layout === "grid";
    const desc = optBool(o.descriptions, true);
    const lbl = optStr(o.label);
    const top = lbl ? 52 : 24;
    const totalStars = list.reduce((a, r) => a + r.stars, 0);
    const right = list.length ? `${sort === "pushed" ? "recently pushed" : "by stars"} · ${groupDigits(totalStars)} stars across ${list.length}` : "";
    const showTime = sort === "pushed";
    let content = "";
    let H: number;

    if (!list.length) {
      H = top + 120;
      content = emptyState(t, 24, top, W - 48, 96, "repo", "No public repositories yet", "Repositories you own will appear here once they are public.");
    } else if (!grid) {
      const rowH = desc ? 54 : 38;
      H = top + list.length * rowH + 14;
      content = list
        .map((r, i) => {
          const y = top + i * rowH;
          const d0 = 0.15 + i * 0.09;
          const nameY = y + (desc ? 21 : 24);
          const descY = y + 39;
          const st = stars(ctx, r.stars, W - 24, nameY, d0 + 0.2);
          const m = meta(ctx, r, W - 24, desc ? descY : nameY, showTime);
          // when descriptions are off, meta sits on the name line left of the star count
          const mInline = !desc && m.svg ? meta(ctx, r, W - 24 - st.w - 18, nameY, showTime) : m;
          const leftMax = W - 24 - 64 - (desc ? Math.max(st.w, m.w) : st.w + (mInline.w ? mInline.w + 18 : 0)) - 28;
          const nameMax = desc ? W - 24 - 64 - st.w - 28 : leftMax;
          const name = fitText(t, r.name, 14, nameMax, { bold: true });
          const rank = String(i + 1).padStart(2, "0");
          const description = desc ? fitText(t, r.description || "No description", 11.5, leftMax) : "";
          return `<g class="in" style="${dl(d0)}">
${i ? `<path d="M24 ${y + 0.5}H${W - 24}" stroke="${t.border}"/>` : ""}
<text x="24" y="${nameY}" font-size="11" class="${i === 0 && sort === "stars" ? "a" : "s"} b">${rank}</text>
<text x="56" y="${nameY}" font-size="14" class="t b">${esc(name)}</text>
${desc ? `<text x="56" y="${descY}" font-size="11.5" class="m">${esc(description)}</text>` : ""}
${st.svg}
${mInline.svg}
</g>`;
        })
        .join("\n");
    } else {
      const gap = 12;
      const tw = (W - 48 - gap) / 2;
      const th = desc ? 104 : 64;
      const nRows = Math.ceil(list.length / 2);
      H = top + nRows * th + (nRows - 1) * gap + 24;
      content = list
        .map((r, i) => {
          const x = 24 + (i % 2) * (tw + gap);
          const y = top + Math.floor(i / 2) * (th + gap);
          const d0 = 0.15 + i * 0.08;
          const st = stars(ctx, r.stars, x + tw - 16, y + 27, d0 + 0.2);
          const name = fitText(t, r.name, 14, tw - 32 - 22 - st.w - 12, { bold: true });
          const lines = desc ? wrapText(t, r.description || "No description", 11.5, tw - 32, 2) : [];
          const footY = y + th - 16;
          const lang = r.language;
          const time = r.pushedAt ? `pushed ${ago(r.pushedAt, ctx.date)}` : "";
          const langW = lang ? textWidth(t, lang.name, 11) : 0;
          return `<g class="in" style="${dl(d0)}">
<rect x="${x.toFixed(1)}" y="${y}" width="${tw.toFixed(1)}" height="${th}" rx="${Math.max(2, t.radius - 2)}" fill="${t.raised}" stroke="${t.border}"/>
${glyph("repo", x + 16, y + 15, 15, t.muted)}
<text x="${(x + 38).toFixed(1)}" y="${y + 27}" font-size="14" class="t b">${esc(name)}</text>
${st.svg}
${lines.map((l, k) => `<text x="${(x + 16).toFixed(1)}" y="${y + 50 + k * 17}" font-size="11.5" class="m">${esc(l)}</text>`).join("")}
${lang ? `<circle cx="${(x + 20).toFixed(1)}" cy="${footY - 3.8}" r="4" fill="${lang.color || t.subtle}"/><text x="${(x + 30).toFixed(1)}" y="${footY}" font-size="11" class="m">${esc(lang.name)}</text>` : ""}
${time ? `<text x="${(x + tw - 16).toFixed(1)}" y="${footY}" font-size="11" text-anchor="end" class="m">${esc(fitText(t, time, 11, tw - 48 - langW))}</text>` : ""}
</g>`;
        })
        .join("\n");
    }
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
${content}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css: TNUM, body });
  },
});
