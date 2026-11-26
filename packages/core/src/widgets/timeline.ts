import { esc } from "../lib/escape";
import { card, fitText, label, svg, textWidth, wrapText } from "../lib/svg";
import { items, n1, str, emptyHint } from "./kit-c";
import { fillPlaceholders } from "./placeholders";
import { defineWidget } from "./types";

const W = 840;

export const timeline = defineWidget({
  type: "timeline",
  title: "Timeline",
  description: "Experience and education on a vertical rail whose nodes light up one after another, with a live pulse on what you do now.",
  scope: "profile",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    label: "experience",
    now: true,
    descriptions: true,
    items: [
      { period: "2023 — now", title: "Senior Software Engineer", place: "Northwind Labs", description: "Leading the developer platform team: build tooling, CI pipelines and a design system used by forty engineers." },
      { period: "2020 — 2023", title: "Full-stack Developer", place: "Lumen & Co.", description: "Shipped a realtime collaborative editor and halved page load times across the product." },
      { period: "2016 — 2020", title: "BSc Computer Science", place: "State University", description: "Distributed systems, compilers and far too many hackathons." },
    ],
  },
  fields: [
    { key: "label", label: "Title", type: "text", placeholder: "experience" },
    { key: "now", label: "Live pulse on the first entry", type: "toggle", help: "Marks the top entry as what you are doing now." },
    { key: "descriptions", label: "Descriptions", type: "toggle" },
    {
      key: "items",
      label: "Entries",
      type: "list",
      itemLabel: "Entry",
      titleKey: "title",
      max: 8,
      newItem: { period: "2024", title: "Role or degree", place: "", description: "" },
      item: [
        { key: "period", label: "Period", type: "text", placeholder: "2021 — 2024", max: 28 },
        { key: "title", label: "Title", type: "text", placeholder: "Software Engineer" },
        { key: "place", label: "Place", type: "text", placeholder: "Company or school" },
        { key: "description", label: "Description", type: "text", multiline: true, max: 280, placeholder: "One or two sentences (optional)" },
      ],
    },
  ],
  alt: (ctx, o) => {
    const list = items(o.items)
      .map((e) => [str(e.period), str(e.title), str(e.place)].filter(Boolean).join(", "))
      .filter(Boolean);
    return list.length ? `${fillPlaceholders(str(o.label), ctx) || "Timeline"}: ${list.join("; ")}` : "Timeline";
  },
  render(ctx, o) {
    const t = ctx.theme;
    const fill = (s: string) => fillPlaceholders(s, ctx);
    const entries = items(o.items)
      .map((e) => ({ period: fill(str(e.period)), title: fill(str(e.title)), place: fill(str(e.place)), description: fill(str(e.description)) }))
      .filter((e) => e.period || e.title || e.place || e.description)
      .slice(0, 8);
    const lbl = fill(str(o.label));
    const top = lbl ? 60 : 32;

    if (!entries.length) {
      const H = top + 64;
      const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${emptyHint(t, W / 2, top + 22, "calendar", "Add roles, degrees or milestones in the inspector")}`;
      return svg({ width: W, height: H, theme: t, title: "Timeline", body });
    }

    const pFs = 12;
    const pOpts = { bold: true, letterSpacing: 0.4 };
    const periodW = Math.min(150, Math.max(64, ...entries.map((e) => textWidth(t, e.period, pFs, pOpts))));
    const railX = 24 + periodW + 28;
    const cx = railX + 28;
    const cw = W - cx - 32;
    const now = o.now !== false;
    const showDesc = o.descriptions !== false;
    const step = 0.38;

    const blocks: string[] = [];
    const nodes: { y: number; i: number }[] = [];
    let y = top;
    entries.forEach((e, i) => {
      const d = 0.2 + i * step;
      const titleY = y + 14;
      const isNow = now && i === 0;
      const badgeW = isNow ? textWidth(t, "NOW", 9.5, { bold: true, letterSpacing: 1.2 }) + 14 : 0;
      const title = fitText(t, e.title || e.place, 15.5, cw - (badgeW ? badgeW + 10 : 0), { bold: true, heading: true });
      const tw = textWidth(t, title, 15.5, { bold: true, heading: true });
      const place = e.title ? fitText(t, e.place, 13, cw) : "";
      const desc = showDesc && e.description ? wrapText(t, e.description, 13, Math.min(cw, 560), 3) : [];
      let yy = titleY;
      const parts: string[] = [];
      const period = fitText(t, e.period, pFs, periodW, pOpts);
      parts.push(`<text x="${24 + periodW}" y="${titleY}" font-size="${pFs}" letter-spacing=".4" text-anchor="end" class="${isNow ? "a" : "m"} b">${esc(period)}</text>`);
      parts.push(`<text x="${cx}" y="${titleY}" font-size="15.5" class="t b h">${esc(title)}</text>`);
      if (isNow) {
        const bx = cx + tw + 10;
        parts.push(`<rect x="${n1(bx)}" y="${titleY - 12}" width="${n1(badgeW)}" height="16" rx="8" fill="${t.accent}" fill-opacity="${t.name === "dark" ? 0.16 : 0.1}" stroke="${t.accent}" stroke-opacity=".5"/>
<text x="${n1(bx + badgeW / 2)}" y="${titleY - 0.8}" font-size="9.5" letter-spacing="1.2" text-anchor="middle" class="a b">NOW</text>`);
      }
      if (place) {
        yy += 21;
        parts.push(`<text x="${cx}" y="${yy}" font-size="13" class="a">${esc(place)}</text>`);
      }
      desc.forEach((l, k) => {
        yy += k === 0 ? 22 : 19;
        parts.push(`<text x="${cx}" y="${yy}" font-size="13" class="m">${esc(l)}</text>`);
      });
      blocks.push(`<g class="in" style="animation-delay:${(d + 0.05).toFixed(2)}s">${parts.join("")}</g>`);
      nodes.push({ y: titleY - 5, i });
      y = yy + 30;
    });
    const H = y - 30 + 28;

    const firstY = nodes[0].y;
    const lastY = nodes[nodes.length - 1].y;
    const railDur = Math.max(0.4, step * (entries.length - 1));
    const css = `
.rail{transform-box:fill-box;transform-origin:top;animation:grow ${n1(railDur)}s linear .2s both}
.lit{transform-box:fill-box;transform-origin:center;animation:pop .55s ease both}
.halo{transform-box:fill-box;transform-origin:center;animation:halo 2.4s ease-out infinite}
@keyframes halo{0%{transform:scale(.6);opacity:.7}100%{transform:scale(2.6);opacity:0}}`;
    const defs = `<linearGradient id="tlRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.accent}" stop-opacity=".5"/></linearGradient>`;
    const rail =
      nodes.length > 1
        ? `<rect x="${railX - 1}" y="${firstY}" width="2" height="${n1(lastY - firstY)}" rx="1" fill="${t.subtle}" opacity=".7"/>
<rect class="rail" x="${railX - 1}" y="${firstY}" width="2" height="${n1(lastY - firstY)}" rx="1" fill="url(#tlRail)"/>`
        : "";
    const nodeMarkup = nodes
      .map(({ y: ny, i }) => {
        const d = 0.2 + i * step;
        const isNow = now && i === 0;
        return `<circle cx="${railX}" cy="${ny}" r="6" fill="${t.card}" stroke="${t.subtle}" stroke-width="1.5"/>
${isNow ? `<circle class="halo loop loop-only" cx="${railX}" cy="${ny}" r="6" fill="${t.accent}" opacity="0"/>` : ""}
<g class="lit" style="animation-delay:${d.toFixed(2)}s"><circle cx="${railX}" cy="${ny}" r="6" fill="${t.card}" stroke="${t.accent}" stroke-width="2"/><circle cx="${railX}" cy="${ny}" r="2.6" fill="${isNow ? t.glow : t.accent}"/></g>`;
      })
      .join("");
    const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${rail}
${nodeMarkup}
${blocks.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
