import { monthName } from "../lib/astro";
import { ago, esc } from "../lib/escape";
import { card, fitText, svg, textWidth, wrapText } from "../lib/svg";
import type { Post } from "../data/types";
import { dl, emptyState, header, longDate, optBool, optNum, optPick, optStr } from "./kit-d";
import { glyph } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;

function feedPosts(ctx: Pick<Ctx, "data">, o: Record<string, unknown>): Post[] {
  const feeds = ctx.data.feeds ?? {};
  const url = optStr(o.feed);
  const list = (url && feeds[url]) || feeds.default || [];
  return list.filter((p) => p && p.title).slice(0, optNum(o.count, 4, 1, 8));
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function origin(url: string): string {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.origin : "";
  } catch {
    return "";
  }
}

function validDate(iso: string): boolean {
  return !!iso && !Number.isNaN(new Date(iso).getTime());
}

export const posts = defineWidget({
  type: "posts",
  title: "Latest posts",
  description: "The newest articles from your blog's RSS or Atom feed, with dates and short summaries, refreshed on every build.",
  category: "Projects",
  kind: "svg",
  width: "full",
  needs: ["feed"],
  defaults: { label: "latest writing", feed: "", link: "", count: 4, dates: "badge", summaries: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "feed", label: "Feed URL", type: "text", placeholder: "https://example.com/rss.xml", help: "RSS or Atom; fetched by the GitHub Action on every build." },
    { key: "link", label: "Card link", type: "text", placeholder: "Defaults to your blog's home page", help: "Images can only link as a whole, so the card opens this page." },
    { key: "count", label: "Posts", type: "number", min: 1, max: 8, step: 1 },
    {
      key: "dates",
      label: "Dates",
      type: "segmented",
      options: [
        { value: "badge", label: "Calendar badge" },
        { value: "relative", label: "3 d ago" },
        { value: "off", label: "Hidden" },
      ],
    },
    { key: "summaries", label: "Summaries", type: "toggle" },
  ],
  alt: (ctx, o) => {
    const h = host(optStr(o.feed));
    return `Latest blog posts${h ? ` from ${h}` : ""}`;
  },
  href: (ctx, o) => {
    const link = optStr(o.link);
    if (link) return link;
    const feed = optStr(o.feed);
    if (feed) return origin(feed) || undefined;
    const first = feedPosts(ctx, o)[0];
    return (first && origin(first.url)) || ctx.data.blog || undefined;
  },
  render(ctx, o) {
    const t = ctx.theme;
    const list = feedPosts(ctx, o);
    const lbl = optStr(o.label);
    const dates = optPick(o.dates, ["badge", "relative", "off"], "badge");
    const summaries = optBool(o.summaries, true);
    const top = lbl ? 50 : 22;
    const site = host(optStr(o.link)) || host(optStr(o.feed)) || (list[0] ? host(list[0].url) : "");
    let H: number;
    let content: string;
    if (!list.length) {
      H = top + 124;
      content = emptyState(t, 24, top, W - 48, 100, "pen", "No posts yet", optStr(o.feed) ? "New articles from your feed will appear here." : "Add your blog's RSS or Atom feed URL.");
    } else {
      const rowH = summaries ? 62 : 44;
      H = top + list.length * rowH + 10;
      content = list
        .map((p, i) => {
          const y = top + i * rowH;
          const d0 = 0.15 + i * 0.1;
          const hasDate = validDate(p.date);
          const badge = dates === "badge" && hasDate;
          const tx = badge ? 84 : 52;
          const rel = dates === "relative" && hasDate ? ago(p.date, ctx.date) : badge ? "" : "";
          const relW = rel ? textWidth(t, rel, 11) + 16 : 0;
          const arrowW = 22;
          const titleMax = W - 24 - tx - relW - arrowW;
          const title = fitText(t, p.title, 14, titleMax, { bold: true });
          const titleY = y + (summaries ? 20 : 26);
          const sum = summaries ? wrapText(t, (p.summary || "").replace(/\s+/g, " ").trim(), 11.5, W - 24 - tx - arrowW, 1)[0] ?? "" : "";
          const dt = hasDate ? new Date(p.date) : null;
          const badgeSvg =
            badge && dt
              ? `<rect x="24" y="${y + 4}" width="44" height="${summaries ? 46 : 32}" rx="${Math.max(4, t.radius - 4)}" fill="${t.raised}" stroke="${t.border}"/>
<text x="46" y="${y + (summaries ? 19 : 15)}" font-size="9" letter-spacing="1.2" text-anchor="middle" class="${i === 0 ? "a" : "m"} b">${monthName(dt.getUTCMonth() + 1).toUpperCase()}</text>
<text x="46" y="${y + (summaries ? 40 : 31)}" font-size="${summaries ? 18 : 13}" text-anchor="middle" class="t b h">${dt.getUTCDate()}</text>`
              : !badge
                ? glyph(i === 0 ? "sparkle" : "book", 24, titleY - 12, 15, i === 0 ? t.accent : t.muted)
                : "";
          const meta = summaries && badge && dt ? `${dt.getUTCFullYear() !== ctx.now.year ? `${dt.getUTCFullYear()} · ` : ""}` : "";
          return `<g class="in" style="${dl(d0)}">
${i ? `<path d="M${tx} ${y - 5.5}H${W - 24}" stroke="${t.border}"/>` : ""}
${badgeSvg}
<text x="${tx}" y="${titleY}" font-size="14" class="t b">${esc(title)}</text>
${sum ? `<text x="${tx}" y="${titleY + 20}" font-size="11.5" class="m">${esc(fitText(t, meta + sum, 11.5, W - 24 - tx - arrowW))}</text>` : ""}
${rel ? `<text x="${W - 24 - arrowW}" y="${titleY}" font-size="11" text-anchor="end" class="m">${esc(rel)}</text>` : ""}
<path d="M${W - 36} ${titleY - 1}l7-7M${W - 34.5} ${titleY - 8}h5.5v5.5" stroke="${i === 0 ? t.accent : t.subtle}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="${i === 0 ? "arrow loop" : ""}"/>
</g>`;
        })
        .join("\n");
    }
    const right = list.length ? fitText(t, site ? `${site}${list[0] && validDate(list[0].date) ? ` · updated ${longDate(list[0].date.slice(0, 10))}` : ""}` : "", 11.5, 420) : "";
    const css = `.arrow{animation:arr 2.4s ease-in-out infinite}@keyframes arr{0%,100%{transform:translate(0,0)}50%{transform:translate(2px,-2px)}}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
${content}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body });
  },
});
