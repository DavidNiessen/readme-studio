import { esc, groupDigits } from "../lib/escape";
import { card, EASE, fitText, label, svg, textWidth } from "../lib/svg";
import { fitLabel } from "./rhythm";
import { defineWidget } from "./types";

const W = 840;

type Mode = "both" | "contributions" | "repos";

export const journey = defineWidget({
  type: "journey",
  title: "Journey timeline",
  description: "Your years on GitHub as a timeline: contributions per year above the axis, repositories you started below.",
  scope: "profile",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["calendar", "repos"],
  defaults: { label: "journey", mode: "both", years: 8 },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "journey", help: "“since <first year>” is appended automatically." },
    {
      key: "mode",
      label: "Show",
      type: "segmented",
      options: [
        { value: "both", label: "Both" },
        { value: "contributions", label: "Contributions" },
        { value: "repos", label: "Repos started" },
      ],
    },
    { key: "years", label: "Years", type: "number", min: 2, max: 15, help: "Most recent years to show; older ones are left out." },
  ],
  alt: () => "my GitHub journey, year by year",
  render(ctx, o) {
    const t = ctx.theme;
    const mode: Mode = o.mode === "contributions" || o.mode === "repos" ? o.mode : "both";
    const showNames = mode !== "contributions";
    const nowYear = ctx.now.year;
    const repos = Array.isArray(ctx.data.repos) ? ctx.data.repos : [];
    const yearOf = (iso: string | null | undefined) => {
      const y = Number(String(iso ?? "").slice(0, 4));
      return y > 2000 && y <= nowYear ? y : nowYear;
    };
    const totalsBy = ctx.data.yearTotals ?? {};
    const contribYears = Object.keys(totalsBy)
      .map(Number)
      .filter((y) => y > 2000 && y <= nowYear && (totalsBy[y] ?? 0) > 0);
    const firstYear = Math.min(nowYear, ctx.data.createdAt ? yearOf(ctx.data.createdAt) : nowYear, ...repos.map((r) => yearOf(r.createdAt)), ...contribYears);
    const maxYears = Math.max(2, Math.min(15, Math.round(Number(o.years) || 8)));
    const startYear = Math.max(firstYear, nowYear - maxYears + 1);
    const years = Array.from({ length: nowYear - startYear + 1 }, (_, i) => startYear + i);

    const x0 = 70;
    const x1 = W - 70;
    const step = years.length > 1 ? (x1 - x0) / (years.length - 1) : 0;
    const colW = years.length > 1 ? Math.min(150, step - 10) : 220;
    const axisY = 150;
    const H = showNames ? 270 : axisY + 62;

    const started = years.map((y) =>
      repos.filter((r) => yearOf(r.createdAt) === y).sort((a, b) => b.stars - a.stars || a.createdAt.localeCompare(b.createdAt)),
    );
    const values = years.map((y, i) =>
      mode === "repos" ? started[i].length : (totalsBy[y] ?? (y === nowYear ? ctx.data.yearTotal : 0)) || 0,
    );
    const max = Math.max(1, ...values);
    const barW = Math.max(10, Math.min(28, step * 0.42 || 28));
    const valueSize = step && step < 56 ? 9.5 : 11;
    const nameSize = step && step < 70 ? 9.5 : 10.5;
    const yearSize = step && step < 56 ? 12 : 15;

    const nodes = years
      .map((y, i) => {
        const x = years.length > 1 ? x0 + i * step : W / 2;
        const d = 0.3 + i * Math.min(0.22, 2.4 / years.length);
        const v = values[i];
        const bh = v ? Math.max(4, (v / max) * 72) : 0;
        const last = y === nowYear;
        const vText = mode === "repos" ? `${v} new` : groupDigits(v);
        const bar =
          bh
            ? `<rect x="${(x - barW / 2).toFixed(1)}" y="${(axisY - 10 - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(4, barW / 3).toFixed(1)}" fill="${last ? t.accent : t.subtle}" style="transform-box:fill-box;transform-origin:bottom;animation:grow .8s ${EASE} ${(d + 0.1).toFixed(2)}s both"/>
<text x="${x.toFixed(1)}" y="${(axisY - 16 - bh).toFixed(1)}" font-size="${valueSize}" text-anchor="middle" class="${last ? "a b" : "m"} fade" style="animation-delay:${(d + 0.5).toFixed(2)}s">${esc(fitText(t, vText, valueSize, Math.max(step, 40)))}</text>`
            : "";
        const list = started[i];
        const names = showNames ? list.slice(0, 2).map((r) => fitText(t, r.name, nameSize, colW)) : [];
        const more = showNames && list.length > 2 ? `+${list.length - 2} more` : "";
        return `<g>
${bar}
<circle cx="${x.toFixed(1)}" cy="${axisY}" r="${last ? 7 : 5}" fill="${last ? t.glow : t.card}" stroke="${last ? t.glow : t.muted}" stroke-width="2" class="fx" style="animation:pop .5s ease ${d.toFixed(2)}s both"/>
${last ? `<circle cx="${x.toFixed(1)}" cy="${axisY}" r="7" stroke="${t.glow}" class="fx loop loop-only" style="animation:ping 1.8s ease-out ${(d + 0.5).toFixed(2)}s infinite"/>` : ""}
<g class="in" style="animation-delay:${(d + 0.1).toFixed(2)}s">
<text x="${x.toFixed(1)}" y="${axisY + 30}" font-size="${yearSize}" text-anchor="middle" class="${last ? "a" : "t"} b h">${y}</text>
${names.map((n, j) => `<text x="${x.toFixed(1)}" y="${axisY + 50 + j * 16}" font-size="${nameSize}" text-anchor="middle" class="m">${esc(n)}</text>`).join("")}
${more ? `<text x="${x.toFixed(1)}" y="${axisY + 82}" font-size="10" text-anchor="middle" class="s">${esc(fitText(t, more, 10, colW))}</text>` : ""}
</g></g>`;
      })
      .join("");

    const nothing = values.every((v) => v === 0) && started.every((l) => l.length === 0);
    const empty = nothing
      ? `<text x="${W / 2}" y="${axisY - 40}" font-size="12" text-anchor="middle" class="m fade" style="animation-delay:.6s">${esc(
          mode === "repos" ? "No public repositories yet. The first one starts the story." : "No contributions recorded yet. Every journey starts somewhere.",
        )}</text>`
      : "";

    const legend = mode === "both" ? "contributions per year · repos started" : mode === "repos" ? "public repositories started per year" : "contributions per year";
    const legendW = Math.min(textWidth(t, legend, 12), W - 48 - 200);
    const head = o.label ? `${String(o.label)} · since ${startYear}` : "";
    const lineLen = x1 - x0;
    const css = `@keyframes ping{0%{transform:scale(1);opacity:1}100%{transform:scale(2.6);opacity:0}}
.axis{stroke-dasharray:${lineLen};stroke-dashoffset:${lineLen};animation:draw ${(0.3 + Math.min(years.length * 0.22, 2.6)).toFixed(2)}s linear .2s forwards}`;
    const body = `${card(t, { width: W, height: H })}
${head ? label(t, 24, 30, fitLabel(t, head, W - 48 - legendW - 24)) : ""}
<text x="${W - 24}" y="30" font-size="12" text-anchor="end" class="m fade">${esc(fitText(t, legend, 12, legendW + 1))}</text>
${years.length > 1 ? `<path d="M${x0} ${axisY}H${x1}" stroke="${t.border}" stroke-width="2"/><path class="axis" d="M${x0} ${axisY}H${x1}" stroke="url(#accentGrad)" stroke-width="2"/>` : `<path d="M${W / 2 - 160} ${axisY}H${W / 2 + 160}" stroke="${t.border}" stroke-width="2" stroke-dasharray="2 6"/>`}
${empty}
${nodes}`;
    return svg({ width: W, height: H, theme: t, title: "my GitHub journey, year by year", css, body });
  },
});
