import { esc, groupDigits } from "../lib/escape";
import { card, fitText, label, svg, textWidth } from "../lib/svg";
import { glyph, type GlyphName } from "./parts";
import { chronotype, fitLabel } from "./rhythm";
import { defineWidget, type Ctx } from "./types";

const W = 415;

export interface Trophy {
  id: string;
  name: string;
  glyph: GlyphName;
  /** 0 = locked, 1..3 = tier */
  tier: number;
  hint: string;
}

export const TROPHY_OPTIONS = [
  { value: "streak", label: "Streaker · longest streak" },
  { value: "month", label: "Centurion · busiest month" },
  { value: "polyglot", label: "Polyglot · languages used" },
  { value: "veteran", label: "Veteran · years on GitHub" },
  { value: "shipper", label: "Shipper · repositories" },
  { value: "stars", label: "Stargazer · stars earned" },
  { value: "chronotype", label: "Night owl / early bird" },
  { value: "consistent", label: "Consistent · active days" },
  { value: "reviewer", label: "Reviewer · code reviews" },
  { value: "collaborator", label: "Collaborator · pull requests" },
  { value: "popular", label: "Popular · followers" },
  { value: "bughunter", label: "Bug hunter · issues opened" },
];

const tierOf = (v: number, steps: [number, number, number]) => (v >= steps[2] ? 3 : v >= steps[1] ? 2 : v >= steps[0] ? 1 : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${groupDigits(n)} ${n === 1 ? one : many}`;

/** Compute one trophy by id; null for unknown ids. */
export function trophy(ctx: Pick<Ctx, "data" | "d" | "now">, id: string): Trophy | null {
  const { data, d } = ctx;
  const created = data.createdAt ? Number(data.createdAt.slice(0, 4)) : NaN;
  const years = Number.isFinite(created) ? Math.max(0, ctx.now.year - created) : 0;
  const repos = Array.isArray(data.repos) ? data.repos : [];
  const stars = data.totals?.stars ?? repos.reduce((a, r) => a + r.stars, 0);
  const hours = data.commitHours && data.commitHours.some((v) => v > 0) ? data.commitHours : null;
  const n = (v: number | null | undefined) => v ?? 0;
  switch (id) {
    case "streak":
      return { id, name: "Streaker", glyph: "flame", tier: tierOf(d.streaks.longest, [7, 14, 30]), hint: `${d.streaks.longest}d best` };
    case "month": {
      const m = d.bestMonth?.total ?? 0;
      return { id, name: "Centurion", glyph: "bolt", tier: tierOf(m, [50, 100, 200]), hint: `${groupDigits(m)} in a month` };
    }
    case "polyglot": {
      const l = (data.languages ?? []).length;
      return { id, name: "Polyglot", glyph: "code", tier: tierOf(l, [3, 5, 8]), hint: plural(l, "language") };
    }
    case "veteran":
      return { id, name: "Veteran", glyph: "trophy", tier: tierOf(years, [2, 4, 6]), hint: years ? `${plural(years, "yr")} on GH` : "new on GH" };
    case "shipper": {
      const c = data.repoCount || repos.length;
      return { id, name: "Shipper", glyph: "rocket", tier: tierOf(c, [10, 25, 50]), hint: plural(c, "repo") };
    }
    case "stars":
      return { id, name: "Stargazer", glyph: "star", tier: tierOf(stars, [5, 20, 100]), hint: plural(stars, "star") };
    case "chronotype": {
      const owl = hours ? chronotype(hours) : null;
      return {
        id,
        name: owl === "early bird" ? "Early Bird" : owl === "night owl" ? "Night Owl" : "9 to 5",
        glyph: owl === "early bird" ? "sparkle" : "moon",
        tier: owl === "night owl" || owl === "early bird" ? 2 : hours ? 1 : 0,
        hint: owl ?? "no hourly data",
      };
    }
    case "consistent":
      return { id, name: "Consistent", glyph: "calendar", tier: tierOf(d.active, [100, 200, 300]), hint: `${d.active} active days` };
    case "reviewer": {
      const v = n(data.totals?.reviews);
      return { id, name: "Reviewer", glyph: "eye", tier: tierOf(v, [10, 50, 200]), hint: plural(v, "review") };
    }
    case "collaborator": {
      const v = n(data.totals?.pullRequests);
      return { id, name: "Collaborator", glyph: "pr", tier: tierOf(v, [10, 50, 200]), hint: plural(v, "PR") };
    }
    case "popular": {
      const v = n(data.followers);
      return { id, name: "Popular", glyph: "users", tier: tierOf(v, [10, 50, 250]), hint: plural(v, "follower") };
    }
    case "bughunter": {
      const v = n(data.totals?.issues);
      return { id, name: "Bug Hunter", glyph: "issue", tier: tierOf(v, [10, 50, 150]), hint: plural(v, "issue") };
    }
    default:
      return null;
  }
}

function hex(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

export const trophies = defineWidget({
  type: "trophies",
  title: "Achievements",
  description: "Hexagonal trophies that unlock in three tiers as your streaks, stars and years on GitHub grow.",
  category: "Stats",
  kind: "svg",
  width: "half",
  needs: ["calendar", "repos", "languages", "hours"],
  defaults: {
    label: "achievements",
    trophies: ["streak", "month", "polyglot", "veteran", "shipper", "stars", "chronotype", "consistent"],
    columns: "4",
  },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "achievements" },
    { key: "trophies", label: "Trophies", type: "checklist", options: TROPHY_OPTIONS, max: 12 },
    {
      key: "columns",
      label: "Columns",
      type: "segmented",
      options: [
        { value: "3", label: "3" },
        { value: "4", label: "4" },
      ],
    },
  ],
  alt: () => "GitHub achievements",
  render(ctx, o) {
    const t = ctx.theme;
    const ids = (Array.isArray(o.trophies) ? (o.trophies as unknown[]) : []).filter((x): x is string => typeof x === "string");
    const list = [...new Set(ids)].map((id) => trophy(ctx, id)).filter((x): x is Trophy => x !== null).slice(0, 12);
    const cols = String(o.columns) === "3" ? 3 : 4;
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const H = list.length ? 196 + (rows - 1) * 104 : 170;
    const cellW = (W - 32) / cols;
    const unlocked = list.filter((x) => x.tier > 0).length;
    const items = list
      .map((tr, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // centre a short last row
        const inRow = row === rows - 1 ? list.length - row * cols : cols;
        const offset = ((cols - inRow) * cellW) / 2;
        const cx = 16 + offset + cellW * (col + 0.5);
        const cy = 100 + row * 104;
        const on = tr.tier > 0;
        const d = 0.2 + i * 0.1;
        const id = `hx${i}`;
        const stroke = tr.tier === 3 ? t.glow : on ? t.accent : t.subtle;
        const maxText = cellW - 6;
        return `<g class="fx" style="animation:pop .55s cubic-bezier(.3,1.4,.5,1) ${d.toFixed(2)}s both;transform-origin:${cx.toFixed(1)}px ${cy}px;transform-box:view-box">
<clipPath id="${id}"><polygon points="${hex(cx, cy, 30)}"/></clipPath>
<polygon points="${hex(cx, cy, 30)}" fill="${on ? t.raised : t.card}" stroke="${stroke}" stroke-width="${on ? 2 : 1}" ${on ? "" : 'stroke-dasharray="3 3"'}/>
${on ? `<g clip-path="url(#${id})"><rect x="${(cx - 60).toFixed(1)}" y="${cy - 40}" width="22" height="80" fill="#fff" opacity="${t.name === "dark" ? 0.12 : 0.6}" class="loop loop-only" style="animation:shine 4s ease-in-out ${(1.5 + i * 0.35).toFixed(2)}s infinite;transform:skewX(-20deg)"/></g>` : ""}
${glyph(tr.glyph, +(cx - 11).toFixed(1), cy - 13, 22, on ? (tr.tier === 3 ? t.glow : t.accent) : t.subtle)}
${on ? `<text x="${cx.toFixed(1)}" y="${cy + 20}" font-size="8.5" text-anchor="middle" class="b" fill="${stroke}">${"I".repeat(tr.tier)}</text>` : `<text x="${cx.toFixed(1)}" y="${cy + 20}" font-size="7" letter-spacing=".5" text-anchor="middle" class="s">LOCKED</text>`}
<text x="${cx.toFixed(1)}" y="${cy + 46}" font-size="11" text-anchor="middle" class="${on ? "t b" : "m"}">${esc(fitText(t, tr.name, 11, maxText, { bold: on }))}</text>
<text x="${cx.toFixed(1)}" y="${cy + 60}" font-size="9" text-anchor="middle" class="m">${esc(fitText(t, tr.hint, 9, maxText))}</text>
</g>`;
      })
      .join("");
    const count = list.length ? `${unlocked}/${list.length} unlocked` : "";
    const countW = count ? textWidth(t, count, 12) : 0;
    const empty = list.length
      ? ""
      : `<g class="in" style="animation-delay:.2s">${glyph("trophy", W / 2 - 11, 70, 22, t.subtle)}
<text x="${W / 2}" y="120" font-size="12" text-anchor="middle" class="m">No trophies selected yet.</text></g>`;
    const css = `@keyframes shine{0%{transform:translateX(0) skewX(-20deg)}40%,100%{transform:translateX(140px) skewX(-20deg)}}`;
    const body = `${card(t, { width: W, height: H })}
${o.label ? label(t, 24, 30, fitLabel(t, String(o.label), W - 48 - (countW ? countW + 16 : 0))) : ""}
${count ? `<text x="${W - 24}" y="30" font-size="12" text-anchor="end" class="m fade" style="animation-delay:.2s">${count}</text>` : ""}
${items}
${empty}`;
    return svg({ width: W, height: H, theme: t, title: "GitHub achievements", css, body });
  },
});
