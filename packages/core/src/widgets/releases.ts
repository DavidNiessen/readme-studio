import { ago, esc } from "../lib/escape";
import { card, fitText, svg, textWidth } from "../lib/svg";
import type { Release } from "../data/types";
import { dl, emptyState, header, longDate, optBool, optList, optNum, optPick, optStr } from "./kit-d";
import { onAccent } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 415;

function pickReleases(ctx: Pick<Ctx, "data">, o: Record<string, unknown>): Release[] {
  const only = new Set(optList(o.repos).map((s) => s.toLowerCase()));
  return [...(ctx.data.releases ?? [])]
    .filter((r) => r && r.tag && (!only.size || only.has((r.repo || "").toLowerCase())))
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, optNum(o.count, 4, 1, 8));
}

export const releases = defineWidget({
  type: "releases",
  title: "Latest releases",
  description: "A timeline of the versions you shipped most recently, with tag pills, repositories and how long ago each landed.",
  category: "Projects",
  kind: "svg",
  width: "half",
  needs: ["releases"],
  defaults: { label: "latest releases", count: 4, names: true, time: "relative", repos: [] },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "count", label: "Releases", type: "number", min: 1, max: 8, step: 1 },
    { key: "names", label: "Release titles", type: "toggle", help: "Show the release title under the repository when it differs from the tag." },
    {
      key: "time",
      label: "Dates",
      type: "segmented",
      options: [
        { value: "relative", label: "3 d ago" },
        { value: "absolute", label: "Mar 4, 2026" },
      ],
    },
    { key: "repos", label: "Only these repositories", type: "tags", placeholder: "repo-name", max: 20, help: "Leave empty to include every repository." },
  ],
  alt: (ctx) => `Latest releases by ${ctx.profile.login}`,
  href: (ctx) => ctx.data.releases?.[0]?.url || `https://github.com/${ctx.profile.login}?tab=repositories`,
  render(ctx, o) {
    const t = ctx.theme;
    const list = pickReleases(ctx, o);
    const lbl = optStr(o.label);
    const top = lbl ? 50 : 22;
    const names = optBool(o.names, true);
    const abs = optPick(o.time, ["relative", "absolute"], "relative") === "absolute";
    const rowH = 48;
    let H: number;
    let content: string;
    if (!list.length) {
      H = top + 128;
      content = emptyState(t, 24, top, W - 48, 104, "tag", "No releases yet", "Tagged releases will show up here.");
    } else {
      H = top + list.length * rowH + 8;
      const lineX = 31;
      const firstY = top + 15;
      const lastY = top + (list.length - 1) * rowH + 15;
      const rail =
        list.length > 1
          ? `<path d="M${lineX} ${firstY}V${lastY}" stroke="${t.border}" stroke-width="2" stroke-linecap="round"/><path d="M${lineX} ${firstY}V${lastY}" stroke="${t.accent}" stroke-opacity=".5" stroke-width="2" stroke-linecap="round" class="rail"/>`
          : "";
      content =
        rail +
        list
          .map((r, i) => {
            const y = top + i * rowH;
            const d0 = 0.2 + i * 0.1;
            const newest = i === 0;
            const cy = y + 15;
            const time = r.publishedAt ? (abs ? longDate(r.publishedAt.slice(0, 10)) : ago(r.publishedAt, ctx.date)) : "";
            const timeW = time ? textWidth(t, time, 11) : 0;
            const tagMax = 120;
            const tag = fitText(t, r.tag, 11, tagMax, { bold: true });
            const tagW = textWidth(t, tag, 11, { bold: true }) + 16;
            const px = 48;
            const pill = newest
              ? `<rect x="${px}" y="${cy - 10}" width="${tagW.toFixed(1)}" height="20" rx="10" fill="${t.accent}"/><text x="${(px + tagW / 2).toFixed(1)}" y="${cy + 4}" font-size="11" text-anchor="middle" fill="${onAccent(t)}" class="b">${esc(tag)}</text>`
              : `<rect x="${px}" y="${cy - 10}" width="${tagW.toFixed(1)}" height="20" rx="10" fill="${t.raised}" stroke="${t.border}"/><text x="${(px + tagW / 2).toFixed(1)}" y="${cy + 4}" font-size="11" text-anchor="middle" class="t b">${esc(tag)}</text>`;
            const repoX = px + tagW + 10;
            const repo = fitText(t, r.repo, 13, W - 24 - repoX - (timeW ? timeW + 12 : 0), { bold: true });
            const title = (r.name || "").trim();
            const sub = names && title && title !== r.tag ? title : abs ? "" : r.publishedAt ? `published ${longDate(r.publishedAt.slice(0, 10))}` : "";
            const dot = newest
              ? `<circle cx="${lineX}" cy="${cy}" r="9" fill="${t.accent}" opacity=".25" class="fx loop" style="animation:ping 2.2s ease-out 1.2s infinite"/><circle cx="${lineX}" cy="${cy}" r="5" fill="${t.accent}"/><circle cx="${lineX}" cy="${cy}" r="2" fill="${onAccent(t)}"/>`
              : `<circle cx="${lineX}" cy="${cy}" r="4.5" fill="${t.card}" stroke="${t.subtle}" stroke-width="2"/>`;
            return `<g class="in" style="${dl(d0)}">
${dot}
${pill}
<text x="${repoX.toFixed(1)}" y="${cy + 4.5}" font-size="13" class="t b">${esc(repo)}</text>
${time ? `<text x="${W - 24}" y="${cy + 4}" font-size="11" text-anchor="end" class="m">${esc(time)}</text>` : ""}
${sub ? `<text x="${px}" y="${cy + 24}" font-size="11" class="m">${esc(fitText(t, sub, 11, W - 24 - px))}</text>` : ""}
</g>`;
          })
          .join("\n");
    }
    const css = `
@keyframes ping{0%{transform:scale(.6);opacity:.6}100%{transform:scale(2);opacity:0}}
.rail{transform-box:fill-box;transform-origin:top;animation:grow 1.2s cubic-bezier(.2,.7,.2,1) .3s both}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${content}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body });
  },
});
