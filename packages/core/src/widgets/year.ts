import { formatIsoDate, monthName, weekdayName, yearProgress } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { odometer } from "../lib/odometer";
import { card, fitSize, fitText, svg, textWidth } from "../lib/svg";
import type { ContributionDay } from "../data/types";
import { streaks } from "../data/derive";
import { TNUM, dl, header, optBool, optPick, optStr, shortDate } from "./kit-d";
import { accentDeep, glyph, onAccent, type GlyphName } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const YEAR_FACTS = [
  { value: "month", label: "Busiest month" },
  { value: "day", label: "Best day" },
  { value: "weekday", label: "Favourite weekday" },
  { value: "language", label: "Top language" },
  { value: "repos", label: "New repositories" },
  { value: "active", label: "Active days" },
  { value: "streak", label: "Longest streak" },
  { value: "stars", label: "Stars on new repos" },
];

interface Fact {
  label: string;
  value: string;
  sub: string;
  glyph: GlyphName;
}

interface Period {
  days: ContributionDay[];
  /** month buckets in display order */
  months: { key: string; label: string; total: number; future: boolean; current: boolean }[];
  title: string;
  range: string;
  total: number;
}

function period(ctx: Ctx, kind: "year" | "rolling"): Period {
  const y = ctx.now.year;
  const today = formatIsoDate(ctx.now);
  const all = ctx.d.days;
  const days = kind === "year" ? all.filter((d) => d.date.startsWith(`${y}-`)) : all;
  const byMonth = new Map<string, number>();
  for (const d of days) byMonth.set(d.date.slice(0, 7), (byMonth.get(d.date.slice(0, 7)) ?? 0) + d.count);
  const months: Period["months"] = [];
  for (let i = 0; i < 12; i++) {
    let yy: number;
    let mm: number;
    if (kind === "year") {
      yy = y;
      mm = i + 1;
    } else {
      const k = ctx.now.month - 11 + i;
      yy = k <= 0 ? y - 1 : y;
      mm = k <= 0 ? k + 12 : k;
    }
    const key = `${yy}-${String(mm).padStart(2, "0")}`;
    months.push({ key, label: monthName(mm), total: byMonth.get(key) ?? 0, future: key > today.slice(0, 7), current: key === today.slice(0, 7) });
  }
  const total = kind === "year" ? days.reduce((a, d) => a + d.count, 0) || ctx.data.yearTotal || 0 : ctx.data.lastYearTotal;
  const first = days[0]?.date;
  return {
    days,
    months,
    total,
    title: kind === "year" ? String(y) : "last 12 months",
    range: kind === "year" ? `Jan 1 – ${shortDate(today)}` : first ? `${shortDate(first)}, ${first.slice(0, 4)} – ${shortDate(today)}` : "",
  };
}

export const year = defineWidget({
  type: "year",
  title: "Year in review",
  description: "Your year, wrapped: total contributions, busiest month, best day, favourite weekday and more, over a monthly bar chart.",
  category: "Stats",
  kind: "svg",
  width: "full",
  needs: ["calendar", "repos", "languages"],
  defaults: { label: "year in review", period: "year", facts: ["month", "day", "weekday", "language", "repos", "active"], chart: true, pace: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "period",
      label: "Period",
      type: "segmented",
      options: [
        { value: "year", label: "Calendar year" },
        { value: "rolling", label: "Last 12 months" },
      ],
    },
    { key: "facts", label: "Highlights", type: "checklist", options: YEAR_FACTS, max: 6, help: "Up to six, shown in a 3 × 2 grid." },
    { key: "chart", label: "Monthly chart", type: "toggle" },
    { key: "pace", label: "Pace & comparison", type: "toggle", help: "Projected total and change against last year." },
  ],
  alt: (ctx, o) => `${ctx.profile.login}'s ${o.period === "rolling" ? "last 12 months" : "year"} in review`,
  render(ctx, o) {
    const t = ctx.theme;
    const kind = optPick(o.period, ["year", "rolling"], "year");
    const p = period(ctx, kind);
    const lbl = optStr(o.label);
    const chart = optBool(o.chart, true);
    const y = ctx.now.year;
    const inYear = (iso: string) => (kind === "year" ? iso.startsWith(`${y}-`) : new Date(iso).getTime() > ctx.date.getTime() - 365 * 86_400_000);

    // ---------------------------------------------------------- facts
    const best = p.days.reduce<ContributionDay | null>((b, d) => (!b || d.count > b.count ? d : b), null);
    const wk = new Array(7).fill(0);
    for (const d of p.days) wk[d.weekday] += d.count;
    const wkMax = Math.max(...wk);
    const bm = [...p.months].filter((m) => m.total > 0).sort((a, b) => b.total - a.total)[0] ?? null;
    const langs = ctx.data.languages ?? [];
    const lb = langs.reduce((a, l) => a + l.bytes, 0);
    const newRepos = (ctx.data.repos ?? []).filter((r) => r.createdAt && inYear(r.createdAt));
    const st = streaks(p.days);
    const active = p.days.filter((d) => d.count > 0).length;
    const factOf = (key: string): Fact | null => {
      switch (key) {
        case "month":
          return bm
            ? { label: "busiest month", value: MONTHS_LONG[Number(bm.key.slice(5)) - 1], sub: `${groupDigits(bm.total)} contributions`, glyph: "calendar" }
            : { label: "busiest month", value: "—", sub: "no activity yet", glyph: "calendar" };
        case "day":
          return best && best.count > 0
            ? { label: "best day", value: shortDate(best.date), sub: `${best.count} contributions · ${weekdayName(best.weekday, true)}`, glyph: "sparkle" }
            : { label: "best day", value: "—", sub: "waiting for day one", glyph: "sparkle" };
        case "weekday":
          return wkMax > 0
            ? { label: "top weekday", value: weekdayName(wk.indexOf(wkMax)), sub: `${Math.round((wkMax / p.total || 0) * 100)}% of the year`, glyph: "chart" }
            : { label: "top weekday", value: "—", sub: "no pattern yet", glyph: "chart" };
        case "language":
          return langs.length && lb > 0
            ? { label: "top language", value: langs[0].name, sub: `${Math.round((langs[0].bytes / lb) * 100)}% of code`, glyph: "code" }
            : { label: "top language", value: "—", sub: "no languages yet", glyph: "code" };
        case "repos":
          return {
            label: "new repositories",
            value: String(newRepos.length),
            sub: newRepos.length ? `latest: ${[...newRepos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].name}` : "none created yet",
            glyph: "repo",
          };
        case "active":
          return { label: "active days", value: groupDigits(active), sub: `of ${p.days.length || 0} days · ${p.days.length ? Math.round((active / p.days.length) * 100) : 0}%`, glyph: "check" };
        case "streak":
          return { label: "longest streak", value: `${st.longest} ${st.longest === 1 ? "day" : "days"}`, sub: st.longestStart ? `from ${shortDate(st.longestStart)}` : "no streak yet", glyph: "flame" };
        case "stars": {
          const s = newRepos.reduce((a, r) => a + r.stars, 0);
          return { label: "stars on new repos", value: groupDigits(s), sub: `across ${newRepos.length} ${newRepos.length === 1 ? "repo" : "repos"}`, glyph: "star" };
        }
        default:
          return null;
      }
    };
    const keys = Array.isArray(o.facts) ? (o.facts as unknown[]).map(String) : [];
    const facts = keys
      .map(factOf)
      .filter((x): x is Fact => x !== null)
      .slice(0, 6);

    // ---------------------------------------------------------- layout
    const top = lbl ? 52 : 24;
    const leftW = facts.length ? 272 : W - 48;
    const factsX = 24 + leftW + 48;
    const cols = facts.length > 4 ? 3 : Math.max(1, Math.min(facts.length, facts.length === 4 ? 2 : 3));
    const fRows = Math.ceil(facts.length / cols);
    const fH = 58;
    const fGap = 14;
    const blockH = Math.max(124, fRows * fH + (fRows - 1) * fGap);
    const chartTop = top + blockH + 30;
    const chartH = 62;
    const H = chart ? chartTop + chartH + 40 : top + blockH + 24;

    // big number
    const totalStr = groupDigits(p.total);
    const bigSize = fitSize(t, totalStr, 60, leftW - 8, 30, { bold: true, heading: true });
    const numY = top + 66;
    const yp = yearProgress(ctx.now);
    const prev = ctx.data.yearTotals?.[y - 1] ?? 0;
    const pace = kind === "year" && yp.fraction < 0.995 && p.total > 0 ? Math.round(p.total / yp.fraction) : p.total;
    const delta = prev > 0 && p.total > 0 ? pace / prev - 1 : null;
    const showPace = optBool(o.pace, true);
    const kicker = kind === "year" ? String(y) : "LAST 12 MONTHS";
    let paceLine = "";
    if (showPace) {
      const txt =
        kind === "year"
          ? p.total === 0
            ? `nothing yet${prev ? ` · ${y - 1}: ${groupDigits(prev)}` : ""}`
            : `${yp.fraction < 0.995 ? `on pace for ${groupDigits(pace)}` : "final total"}${prev ? ` · ${y - 1}: ${groupDigits(prev)}` : ""}`
          : `${groupDigits(active)} active days · ${(p.total / Math.max(1, p.days.length)).toFixed(1)} a day`;
      let pillSvg = "";
      let pillW = 0;
      if (delta !== null && kind === "year") {
        const up = delta >= 0;
        const ptxt = `${up ? "▲" : "▼"} ${Math.abs(Math.round(delta * 100))}%`;
        pillW = textWidth(t, ptxt, 10.5, { bold: true }) + 14;
        pillSvg = `<rect x="24" y="${numY + 44}" width="${pillW.toFixed(1)}" height="18" rx="9" fill="${up ? t.accent : t.raised}"${up ? "" : ` stroke="${t.border}"`}/><text x="${(24 + pillW / 2).toFixed(1)}" y="${numY + 56.5}" font-size="10.5" text-anchor="middle" ${up ? `fill="${onAccent(t)}"` : 'class="m"'} class="b">${esc(ptxt)}</text>`;
      }
      const tx = 24 + (pillW ? pillW + 8 : 0);
      paceLine = `<g class="in" style="${dl(0.7)}">${pillSvg}<text x="${tx.toFixed(1)}" y="${numY + 57}" font-size="11.5" class="m">${esc(fitText(t, txt, 11.5, leftW - (tx - 24)))}</text></g>`;
    }
    const big = `<g class="in" style="${dl(0.15)}">
<text x="24" y="${top + 6}" font-size="11" letter-spacing="3" class="a b">${esc(kicker)}</text>
<g class="tn">${odometer(t, totalStr, { x: 22, y: numY, fontSize: bigSize, delay: 0.3, duration: 2.2, heading: true })}</g>
<text x="24" y="${numY + 26}" font-size="13" class="t b">${p.total === 1 ? "contribution" : "contributions"}</text>
</g>${paceLine}`;

    // facts grid
    const fW = (W - 24 - factsX - (cols - 1) * 16) / cols;
    const factSvg = facts
      .map((fa, i) => {
        const fx = factsX + (i % cols) * (fW + 16);
        const fy = top - 8 + Math.floor(i / cols) * (fH + fGap);
        const d0 = 0.35 + i * 0.08;
        const vSize = fitSize(t, fa.value, 18, fW - 4, 12, { bold: true, heading: true });
        return `<g class="in" style="${dl(d0)}">
${glyph(fa.glyph, fx, fy, 13, t.accent)}
<text x="${(fx + 20).toFixed(1)}" y="${fy + 10.5}" font-size="10" letter-spacing="1.2" class="m">${esc(fitText(t, fa.label.toUpperCase(), 10, fW - 20, { letterSpacing: 1.2 }))}</text>
<text x="${fx.toFixed(1)}" y="${fy + 35}" font-size="${vSize}" class="t b h">${esc(fitText(t, fa.value, vSize, fW, { bold: true, heading: true }))}</text>
<text x="${fx.toFixed(1)}" y="${fy + 52}" font-size="11" class="m">${esc(fitText(t, fa.sub, 11, fW))}</text>
</g>`;
      })
      .join("\n");
    const divider = facts.length ? `<path d="M${factsX - 24} ${top - 8}V${top + blockH - 8}" stroke="${t.border}" class="fade" style="${dl(0.3)}"/>` : "";

    // monthly chart
    let chartSvg = "";
    if (chart) {
      const mMax = Math.max(1, ...p.months.map((m) => m.total));
      const slot = (W - 48) / 12;
      const bw = Math.min(42, slot - 18);
      const base = chartTop + chartH;
      const bmKey = bm?.key;
      chartSvg =
        `<path d="M24 ${base + 0.5}H${W - 24}" stroke="${t.border}"/>` +
        p.months
          .map((m, i) => {
            const x = 24 + i * slot + (slot - bw) / 2;
            const h = m.future ? 0 : Math.max(m.total > 0 ? 3 : 1.5, (m.total / mMax) * chartH);
            const isBest = m.key === bmKey;
            const d0 = 0.6 + i * 0.06;
            const fill = isBest ? "url(#bestG)" : m.current ? t.accent : t.subtle;
            const bar = m.future
              ? `<rect x="${x.toFixed(1)}" y="${base - 10}" width="${bw}" height="10" rx="3" stroke="${t.subtle}" stroke-dasharray="2 3" fill="none" class="fade" style="${dl(d0)}"/>`
              : `<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="${Math.min(4, h / 2).toFixed(1)}" fill="${fill}"${m.current && !isBest ? ' fill-opacity=".55"' : ""} class="bar" style="${dl(d0)}"/>`;
            const val =
              (isBest || m.current) && m.total > 0
                ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(base - h - 7).toFixed(1)}" font-size="10.5" text-anchor="middle" class="${isBest ? "t b" : "m"} fade" style="${dl(d0 + 0.6)}">${esc(groupDigits(m.total))}</text>`
                : "";
            return `${isBest ? `<rect x="${(x - 3).toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw + 6}" height="${h.toFixed(1)}" rx="5" fill="${t.accent}" opacity=".16" filter="url(#softglow)" class="fade"/>` : ""}${bar}${val}
<text x="${(x + bw / 2).toFixed(1)}" y="${base + 18}" font-size="10.5" text-anchor="middle" class="${isBest ? "a b" : m.future ? "s" : "m"}">${m.label}</text>`;
          })
          .join("\n");
    }
    const css = `${TNUM}.bar{transform-box:fill-box;transform-origin:bottom;animation:grow .9s cubic-bezier(.2,.7,.2,1) both}`;
    const defs = `<linearGradient id="bestG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, kind === "year" ? `${lbl}` : lbl, p.range) : ""}
${big}
${divider}
${factSvg}
${chartSvg}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
