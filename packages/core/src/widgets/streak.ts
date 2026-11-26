import { formatIsoDate } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { arcPath, card, fitText, svg, textWidth } from "../lib/svg";
import { TNUM, dateRange, dl, header, optBool, optPick, optStr, shortDate } from "./kit-d";
import { accentDeep, glyph } from "./parts";
import { defineWidget, type Ctx } from "./types";

const W = 840;
const COLS = [140, 420, 700];

type TotalKind = "lastYear" | "year" | "allTime";

/** Start/end dates of the current streak (end may be yesterday when today is still empty). */
function currentRange(ctx: Ctx): [string, string] | null {
  const days = ctx.d.days;
  const n = ctx.d.streaks.current;
  if (!n || !days.length) return null;
  let end = days.length - 1;
  if (days[end].count === 0) end--;
  const start = end - n + 1;
  if (start < 0 || end < 0) return null;
  return [days[start].date, days[end].date];
}

/** Flame with an inner core, flickering from its base, plus rising embers. */
function flame(ctx: Ctx, cx: number, base: number, lit: boolean, embers: boolean): string {
  const t = ctx.theme;
  const outer = "M0 -28C6 -20 12 -15 12 -7C12 0 6.6 4 0 4C-6.6 4 -12 0 -12 -7C-12 -13 -8 -17 -5 -21C-4.5 -16 -2.5 -13.5 0 -13C-1.5 -18 -1.5 -23 0 -28Z";
  const inner = "M0 -12C3 -8 6 -6 6 -2C6 1.5 3.3 3.5 0 3.5C-3.3 3.5 -6 1.5 -6 -2C-6 -5 -3 -7 0 -12Z";
  if (!lit) {
    return `<g transform="translate(${cx} ${base})" class="in" style="${dl(0.5)}"><path d="${outer}" fill="${t.raised}" stroke="${t.subtle}" stroke-width="1.2"/><path d="${inner}" fill="${t.subtle}" opacity=".6"/></g>`;
  }
  const sparks = embers
    ? [-5, 3, 7]
        .map(
          (dx, i) =>
            `<circle cx="${dx}" cy="-18" r="${i === 1 ? 1.6 : 1.2}" fill="${t.glow}" class="ember loop loop-only" style="animation-delay:${(1.6 + i * 0.7).toFixed(1)}s"/>`,
        )
        .join("")
    : "";
  return `<g transform="translate(${cx} ${base})">
<circle cx="0" cy="-10" r="16" fill="${t.accent}" opacity=".45" filter="url(#softglow)" class="halo loop"/>
<g class="fpop"><g class="flick loop"><path d="${outer}" fill="url(#flameG)"/><path d="${inner}" fill="url(#coreG)" class="core loop"/></g></g>
${sparks}
</g>`;
}

export const streak = defineWidget({
  type: "streak",
  title: "Streak card",
  description: "Current streak in a burning ring, flanked by your longest run and total contributions, each with its date range.",
  scope: "profile",
  category: "Stats",
  kind: "svg",
  width: "full",
  needs: ["calendar"],
  defaults: { label: "streak · last 12 months", total: "lastYear", ranges: true, ring: true, embers: true },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "Leave empty for a compact card" },
    {
      key: "total",
      label: "Total contributions",
      type: "segmented",
      options: [
        { value: "lastYear", label: "12 months" },
        { value: "year", label: "This year" },
        { value: "allTime", label: "All time" },
      ],
    },
    { key: "ranges", label: "Date ranges", type: "toggle", help: "Show when each streak started and ended." },
    { key: "ring", label: "Record ring", type: "toggle", help: "The ring fills as your current streak approaches your longest." },
    { key: "embers", label: "Rising embers", type: "toggle" },
  ],
  alt: () => "GitHub contribution streak",
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const kind = optPick<TotalKind>(o.total, ["lastYear", "year", "allTime"], "lastYear");
    const ranges = optBool(o.ranges, true);
    const ringOn = optBool(o.ring, true);
    const { current, longest, longestStart, longestEnd } = ctx.d.streaks;
    const today = formatIsoDate(ctx.now);
    const first = ctx.d.days[0]?.date ?? today;
    const off = lbl ? 0 : -24;
    const H = (ranges ? 200 : 182) + off;
    const capY = 160 + off;
    const subY = 179 + off;

    // ------------------------------------------------------ side columns
    const totals: Record<TotalKind, { value: number; cap: string; sub: string }> = {
      lastYear: { value: ctx.data.lastYearTotal, cap: "total contributions", sub: dateRange(first, today, today) },
      year: { value: ctx.data.yearTotal, cap: `contributions in ${ctx.now.year}`, sub: `Jan 1 – today` },
      allTime: {
        value: ctx.data.allTimeTotal,
        cap: "all-time contributions",
        sub: ctx.data.createdAt ? `since ${shortDate(ctx.data.createdAt.slice(0, 10))}, ${ctx.data.createdAt.slice(0, 4)}` : "since joining",
      },
    };
    const tot = totals[kind];
    const numY = 128 + off;
    const side = (cx: number, value: string, unit: string, g: "sigma" | "trophy", cap: string, sub: string, d0: number) => {
      const size = 34;
      const vw = odometerWidth(t, value, size, true, true);
      const uw = unit ? textWidth(t, unit, 13) + 6 : 0;
      const x0 = cx - (vw + uw) / 2;
      return `<g class="in" style="${dl(d0)}">
${glyph(g, cx - 8, 66 + off, 16, t.accent)}
<g class="tn">${odometer(t, value, { x: x0, y: numY, fontSize: size, delay: d0 + 0.15, heading: true })}</g>
${unit ? `<text x="${(x0 + vw + 6).toFixed(1)}" y="${numY}" font-size="13" class="m">${esc(unit)}</text>` : ""}
<text x="${cx}" y="${capY}" font-size="11" letter-spacing="1.5" text-anchor="middle" class="t b">${esc(fitText(t, cap.toUpperCase(), 11, 240, { bold: true, letterSpacing: 1.5 }))}</text>
${ranges ? `<text x="${cx}" y="${subY}" font-size="11.5" text-anchor="middle" class="m">${esc(fitText(t, sub, 11.5, 240))}</text>` : ""}
</g>`;
    };
    const longestSub = longest > 0 && longestStart && longestEnd ? dateRange(longestStart, longestEnd, today) : "no streak yet";
    const left = side(COLS[0], groupDigits(tot.value), "", "sigma", tot.cap, tot.sub, 0.25);
    const right = side(COLS[2], groupDigits(longest), longest === 1 ? "day" : "days", "trophy", "longest streak", longestSub, 0.4);

    // ------------------------------------------------------ centre ring
    const cx = COLS[1];
    const cy = 104 + off;
    const r = 38;
    const gap = 30;
    const sweep = 360 - gap * 2;
    const frac = longest > 0 ? Math.min(1, current / longest) : 0;
    const arcLen = (Math.PI * 2 * r * sweep) / 360;
    const track = arcPath(cx, cy, r, gap, 360 - gap);
    const lit = current > 0;
    const cr = currentRange(ctx);
    const curSub = lit && cr ? (cr[1] === today ? dateRange(cr[0], cr[1], today) : `${dateRange(cr[0], cr[1])} · today pending`) : "start a new one today";
    const record = lit && current >= longest && longest > 1;
    const value = groupDigits(current);
    const vSize = value.length > 3 ? 24 : 30;
    const centre = `<g class="in" style="${dl(0.1)}">
<path d="${track}" stroke="${t.subtle}" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>
${ringOn && frac > 0 ? `<path d="${track}" stroke="url(#ringG)" stroke-width="6" stroke-linecap="round" class="ring"/>` : ""}
</g>
${flame(ctx, cx, cy - r + 10, lit, optBool(o.embers, true))}
<g class="in" style="${dl(0.3)}">
<g class="tn">${odometer(t, value, { x: cx, y: cy + 9, fontSize: vSize, anchor: "middle", delay: 0.45, heading: true, className: lit ? "t b" : "m b" })}</g>
<text x="${cx}" y="${cy + 25}" font-size="9.5" letter-spacing="1.5" text-anchor="middle" class="m">${current === 1 ? "DAY" : "DAYS"}</text>
<text x="${cx}" y="${capY}" font-size="11" letter-spacing="1.5" text-anchor="middle" class="a b">${record ? "CURRENT · NEW RECORD" : "CURRENT STREAK"}</text>
${ranges ? `<text x="${cx}" y="${subY}" font-size="11.5" text-anchor="middle" class="m">${esc(fitText(t, curSub, 11.5, 240))}</text>` : ""}
</g>`;

    const divTop = 60 + off;
    const divBot = H - 22;
    const dividers = [280, 560]
      .map((x) => `<path d="M${x} ${divTop}V${divBot}" stroke="${t.border}" class="fade" style="${dl(0.2)}"/>`)
      .join("");
    const css = `${TNUM}
.ring{stroke-dasharray:${arcLen.toFixed(1)};stroke-dashoffset:${arcLen.toFixed(1)};animation:ringTo 1.8s cubic-bezier(.2,.7,.2,1) .6s forwards}
@keyframes ringTo{to{stroke-dashoffset:${(arcLen * (1 - frac)).toFixed(1)}}}
.fpop{transform-box:fill-box;transform-origin:50% 100%;animation:pop .7s ease .35s both}
.flick{transform-box:fill-box;transform-origin:50% 100%;animation:flick 1.6s ease-in-out infinite}
@keyframes flick{0%,100%{transform:scale(1,1) skewX(0)}25%{transform:scale(.97,1.06) skewX(-2deg)}50%{transform:scale(1.02,.96) skewX(1.5deg)}75%{transform:scale(.98,1.04) skewX(-1deg)}}
.core{transform-box:fill-box;transform-origin:50% 100%;animation:core 1.1s ease-in-out infinite}
@keyframes core{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.86)}}
.halo{animation:pulse 2.4s ease-in-out infinite}
.ember{opacity:0;animation:ember 2.2s ease-out infinite}
@keyframes ember{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(2px,-22px)}}`;
    const defs = `<linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<linearGradient id="flameG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>
<linearGradient id="coreG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="${t.glow}" stop-opacity=".6"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${dividers}
${left}
${centre}
${right}`;
    return svg({ width: W, height: H, theme: t, title: `Current streak ${current} days, longest ${longest} days`, css, defs, body });
  },
});
