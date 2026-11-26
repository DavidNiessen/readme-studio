import { pad2, weekdayName } from "../lib/astro";
import { esc, num } from "../lib/escape";
import { card, EASE, fitText, label, polar, svg, textWidth } from "../lib/svg";
import { defineWidget } from "./types";

const W = 415;
const H = 300;
/** Monday-first short weekday names. */
const DAYS = Array.from({ length: 7 }, (_, i) => weekdayName(i + 1, true));

/** "night owl", "early bird" or "day shift" from a 24-bucket commit histogram. */
export function chronotype(hours: number[]): string {
  const total = hours.reduce((a, b) => a + b, 0) || 1;
  const sum = (a: number, b: number) => hours.slice(a, b).reduce((x, y) => x + y, 0) / total;
  const night = sum(21, 24) + sum(0, 5);
  const morning = sum(5, 11);
  if (night > 0.3) return "night owl";
  if (morning > 0.35) return "early bird";
  return "day shift";
}

/** Fit a section label (rendered uppercase, bold, letter-spaced) into `max` px. */
export function fitLabel(t: Parameters<typeof textWidth>[0], text: string, max: number): string {
  return fitText(t, text.toUpperCase(), 12, max - 16, { bold: true, letterSpacing: 2 });
}

export const rhythm = defineWidget({
  type: "rhythm",
  title: "Coding rhythm",
  description: "A 24-hour radial clock of when you commit, with your chronotype and busiest weekday.",
  scope: "profile",
  category: "Activity",
  kind: "svg",
  width: "half",
  needs: ["hours", "calendar"],
  defaults: { label: "coding rhythm", weekdays: true, summary: true },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "coding rhythm" },
    { key: "weekdays", label: "Weekday strip", type: "toggle", help: "Contributions per weekday next to the clock." },
    { key: "summary", label: "Summary line", type: "toggle", help: "Chronotype, peak hour and daily average." },
  ],
  alt: () => "coding rhythm by hour of day and weekday",
  render(ctx, o) {
    const t = ctx.theme;
    const hours = ctx.data.commitHours && ctx.data.commitHours.length === 24 ? ctx.data.commitHours : null;
    const hasHours = hours !== null && hours.some((v) => v > 0);
    const showDays = Boolean(o.weekdays);
    const summary = Boolean(o.summary);
    const cx = showDays ? 124 : W / 2;
    const cy = 164;
    const r0 = 38;
    const r1 = 84;
    let clock = "";
    let center = "";
    let left = "";
    if (hours && hasHours) {
      const max = Math.max(1, ...hours);
      const peak = hours.indexOf(max);
      clock = hours
        .map((v, h) => {
          const len = Math.max(2, (v / max) * (r1 - r0));
          const a = h * 15;
          const [x1, y1] = polar(cx, cy, r0, a);
          const [x2, y2] = polar(cx, cy, r0 + len, a);
          const color = h === peak ? t.glow : v / max > 0.6 ? t.accent : t.subtle;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)}" stroke-dashoffset="${len.toFixed(1)}" style="animation:draw .8s ${EASE} ${(0.3 + h * 0.04).toFixed(2)}s forwards"/>`;
        })
        .join("");
      const [hx, hy] = polar(cx, cy, r0 - 6, peak * 15);
      clock += `<g style="transform-origin:${cx}px ${cy}px;animation:spin 60s linear infinite" class="loop loop-only"><circle cx="${cx}" cy="${cy - r1 - 5}" r="2.5" fill="${t.glow}" filter="url(#glow)"/></g>
<line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${t.glow}" stroke-width="2" stroke-linecap="round" class="fade" style="animation-delay:1.4s"/>`;
      center = `<circle cx="${cx}" cy="${cy}" r="4" fill="${t.glow}" class="fade" style="animation-delay:1.4s"/>`;
      left = `${chronotype(hours)} · peak ${pad2(peak)}:00`;
    } else {
      clock = `<circle cx="${cx}" cy="${cy}" r="${(r0 + r1) / 2}" stroke="${t.subtle}" stroke-width="7" stroke-dasharray="2 6" class="fade" style="animation-delay:.3s"/>`;
      center = `<text x="${cx}" y="${cy - 2}" font-size="10" text-anchor="middle" class="m">${esc(fitText(t, "no hourly", 10, (r0 - 12) * 2))}</text>
<text x="${cx}" y="${cy + 11}" font-size="10" text-anchor="middle" class="m">${esc(fitText(t, "data yet", 10, (r0 - 12) * 2))}</text>`;
      left = "hourly data pending";
    }
    const ticks = [0, 6, 12, 18]
      .map((h) => {
        const [x, y] = polar(cx, cy, r1 + 14, h * 15);
        return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" text-anchor="middle" class="m fade" style="animation-delay:.2s">${pad2(h)}</text>`;
      })
      .join("");

    const wd = ctx.d.weekdays.length === 7 ? ctx.d.weekdays : new Array(7).fill(0);
    const wTotal = wd.reduce((a, b) => a + b, 0);
    const wMax = Math.max(...wd);
    const best = wMax > 0 ? wd.indexOf(wMax) : -1;
    let bars = "";
    if (showDays) {
      const lx = 256;
      const lw = Math.max(...DAYS.map((d) => textWidth(t, d, 11, { bold: true })));
      const bx = lx + lw + 10;
      const bw = W - 26 - bx;
      bars = wd
        .map((v, i) => {
          const y = 74 + i * 26;
          const w = Math.max(3, wMax > 0 ? (v / wMax) * bw : 3);
          const on = i === best;
          return `<g class="in" style="animation-delay:${(0.4 + i * 0.08).toFixed(2)}s"><text x="${lx}" y="${y + 9}" font-size="11" class="${on ? "a b" : "m"}">${DAYS[i]}</text>
<rect x="${bx.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="10" rx="3" fill="${t.raised}"/>
<rect x="${bx.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="10" rx="3" fill="${on ? t.accent : t.subtle}" style="transform-box:fill-box;transform-origin:left;animation:growX .8s ${EASE} ${(0.6 + i * 0.08).toFixed(2)}s both"/></g>`;
        })
        .join("");
    }

    let foot = "";
    if (summary) {
      const right = wTotal > 0 ? `⌀ ${num(ctx.d.average, 1)}/day${best >= 0 && showDays ? ` · best ${DAYS[best]}` : ""}` : "no contributions yet";
      const rightW = Math.min(textWidth(t, right, 10), W - 48 - 150);
      const leftMax = W - 48 - rightW - 16;
      foot = `<g class="in" style="animation-delay:1.2s"><text x="24" y="${H - 18}" font-size="11" class="${hasHours ? "t b" : "m"}">${esc(fitText(t, left, 11, leftMax, { bold: hasHours }))}</text>
<text x="${W - 24}" y="${H - 18}" font-size="10" text-anchor="end" class="m">${esc(fitText(t, right, 10, rightW + 1))}</text></g>`;
    }

    const body = `${card(t, { width: W, height: H })}
${o.label ? label(t, 24, 30, fitLabel(t, String(o.label), W - 48)) : ""}
<circle cx="${cx}" cy="${cy}" r="${r1 + 5}" stroke="${t.border}" stroke-dasharray="1 5" class="fade"/>
<circle cx="${cx}" cy="${cy}" r="${r0 - 10}" fill="${t.raised}" stroke="${t.border}"/>
${clock}
${ticks}
${center}
${bars}
${foot}`;
    return svg({ width: W, height: H, theme: t, title: "coding rhythm by hour of day and weekday", body });
  },
});
