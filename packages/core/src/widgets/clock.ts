import { localParts, monthName, pad2, weekdayName, yearProgress, zoneAbbr, zoneOffset } from "../lib/astro";
import { esc } from "../lib/escape";
import { card, f, fitSize, fitText, polar, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { TNUM, dl, header, optBool, optPick, optStr } from "./kit-d";
import { accentDeep, glyph } from "./parts";
import { defineWidget } from "./types";

const W = 415;

/** Approximate sunrise/sunset in local clock hours (simple declination model, no refraction or equation of time). */
export function daylight(lat: number, lon: number, dayOfYear: number, offsetMin: number): { rise: number; set: number; length: number } {
  const rad = Math.PI / 180;
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear));
  const x = -Math.tan(lat * rad) * Math.tan(decl * rad);
  const omega = x <= -1 ? 180 : x >= 1 ? 0 : Math.acos(x) / rad;
  const length = (2 * omega) / 15;
  const noon = 12 + offsetMin / 60 - lon / 15;
  return { rise: noon - length / 2, set: noon + length / 2, length };
}

function hm(h: number): string {
  const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function offsetLabel(min: number): string {
  const s = min < 0 ? "−" : "+";
  const a = Math.abs(min);
  return `UTC${s}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}

let sid = 0;

/** A clipped column of values that steps through `values` in real time (CSS steps()), starting at index 0. */
function strip(t: Theme, values: string[], x: number, y: number, size: number, cls: string, period: number, offset: number, slotW: number): string {
  const id = `st${sid++}`;
  const lineH = Math.round(size * 1.3);
  const n = values.length;
  const texts = values
    .map((v, k) => `<text x="${f(x)}" y="${f(y + k * lineH)}" font-size="${size}" text-anchor="middle" class="${cls}">${esc(v)}</text>`)
    .join("");
  if (t.motion === "off" || n < 2) return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" text-anchor="middle" class="${cls}">${esc(values[0] ?? "")}</text>`;
  return `<clipPath id="${id}"><rect x="${f(x - slotW / 2 - 2)}" y="${f(y - size * 0.95)}" width="${f(slotW + 4)}" height="${lineH}"/></clipPath>
<style>@keyframes k${id}{to{transform:translateY(-${n * lineH}px)}}</style>
<g clip-path="url(#${id})"><g style="animation:k${id} ${period}s steps(${n}) -${offset.toFixed(2)}s infinite">${texts}</g></g>`;
}

function rotate<T>(arr: T[], start: number): T[] {
  const s = ((start % arr.length) + arr.length) % arr.length;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

export const clock = defineWidget({
  type: "clock",
  title: "Local time",
  description: "A live clock for your time zone that keeps ticking after the build, with your city, UTC offset and today's daylight band.",
  category: "Identity",
  kind: "svg",
  width: "half",
  defaults: { label: "local time", style: "analogue", seconds: true, hour12: false, daylight: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "style",
      label: "Style",
      type: "segmented",
      options: [
        { value: "analogue", label: "Analogue" },
        { value: "digital", label: "Digital" },
      ],
    },
    { key: "seconds", label: "Seconds", type: "toggle" },
    { key: "hour12", label: "12-hour clock", type: "toggle", when: { key: "style", is: ["digital"] } },
    { key: "daylight", label: "Daylight band", type: "toggle", help: "Approximate sunrise and sunset from your profile location." },
  ],
  alt: (ctx) => `Local time in ${ctx.profile.location.city || ctx.profile.location.timezone || "UTC"}`,
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const tz = ctx.profile.location.timezone || "UTC";
    const style = optPick(o.style, ["analogue", "digital"], "analogue");
    const secOn = optBool(o.seconds, true);
    const h12 = optBool(o.hour12, false);
    const showDay = optBool(o.daylight, true);
    let lp;
    try {
      lp = localParts(ctx.date, tz);
    } catch {
      lp = ctx.now;
    }
    const sec = ctx.date.getUTCSeconds();
    const { hour: h, minute: m } = lp;
    let off = 0;
    try {
      off = zoneOffset(ctx.date, tz);
    } catch {
      off = 0;
    }
    const abbr = zoneAbbr(ctx.date, tz);
    const city = ctx.profile.location.city || (tz.includes("/") ? tz.split("/").pop()!.replace(/_/g, " ") : tz);

    const top = lbl ? 46 : 18;
    const H = top + 160;
    const cx = 24 + 70;
    const cy = top + 80;
    const r = 68;
    let left = "";
    let css = "";

    if (style === "analogue") {
      const ticks = Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const [x1, y1] = polar(cx, cy, r - 7, i * 6);
        const [x2, y2] = polar(cx, cy, r - (major ? 14 : 10), i * 6);
        return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${major ? t.text : t.subtle}" stroke-width="${major ? 1.8 : 1}" stroke-linecap="round"/>`;
      }).join("");
      const nums = [12, 3, 6, 9]
        .map((n) => {
          const [x, y] = polar(cx, cy, r - 24, n * 30);
          return `<text x="${f(x)}" y="${f(y + 3.8)}" font-size="10.5" text-anchor="middle" class="m b">${n}</text>`;
        })
        .join("");
      const aH = ((h % 12) + m / 60 + sec / 3600) * 30;
      const aM = (m + sec / 60) * 6;
      const aS = sec * 6;
      const hand = (angle: number, period: number, timing: string, inner: string) =>
        `<g transform="rotate(${f(angle, 2)} ${cx} ${cy})"><g style="transform-origin:${cx}px ${cy}px;animation:spin ${period}s ${timing} infinite">${inner}</g></g>`;
      left = `<g class="in" style="${dl(0.1)}">
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.raised}" stroke="${t.border}"/>
<circle cx="${cx}" cy="${cy}" r="${r - 4}" stroke="${t.border}" stroke-opacity=".7"/>
${ticks}${nums}
${hand(aH, 43200, "linear", `<path d="M${cx} ${cy + 8}V${cy - 34}" stroke="${t.text}" stroke-width="4.5" stroke-linecap="round"/>`)}
${hand(aM, 3600, "linear", `<path d="M${cx} ${cy + 10}V${cy - 52}" stroke="${t.text}" stroke-width="3" stroke-linecap="round"/>`)}
${secOn ? hand(aS, 60, "steps(60)", `<path d="M${cx} ${cy + 14}V${cy - 56}" stroke="${t.accent}" stroke-width="1.4" stroke-linecap="round"/><circle cx="${cx}" cy="${cy - 44}" r="2.6" fill="${t.accent}"/>`) : ""}
<circle cx="${cx}" cy="${cy}" r="4.5" fill="${t.accent}"/><circle cx="${cx}" cy="${cy}" r="1.6" fill="${t.raised}"/>
</g>`;
    } else {
      const bx = 24;
      const bw = 150;
      const by = cy - 56;
      const bh = 112;
      const size = 34;
      const dAdv = textWidth(t, "0", size, { bold: true, heading: true });
      const pairW = textWidth(t, "00", size, { bold: true, heading: true });
      const colonW = textWidth(t, ":", size, { bold: true, heading: true });
      const timeW = pairW + colonW + dAdv * 2;
      const x0 = bx + (bw - timeW) / 2;
      const ty = by + 58;
      const hours = h12 ? rotate(["12", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"], h % 12) : rotate(Array.from({ length: 24 }, (_, i) => pad2(i)), h);
      const hourPeriod = h12 ? 43200 : 86400;
      const cls = "t b h";
      const hh = strip(t, hours, x0 + pairW / 2, ty, size, cls, hourPeriod, m * 60 + sec, pairW);
      const colonX = x0 + pairW + colonW / 2;
      const mt = strip(t, rotate(["0", "1", "2", "3", "4", "5"], Math.floor(m / 10)), x0 + pairW + colonW + dAdv / 2, ty, size, cls, 3600, (m % 10) * 60 + sec, dAdv);
      const mo = strip(t, rotate(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], m % 10), x0 + pairW + colonW + dAdv * 1.5, ty, size, cls, 600, sec, dAdv);
      const ampm = h12 ? strip(t, rotate(["AM", "PM"], h >= 12 ? 1 : 0), bx + bw / 2, by + 22, 10, "m b", 86400, (h % 12) * 3600 + m * 60 + sec, 24) : `<text x="${bx + bw / 2}" y="${by + 22}" font-size="9.5" letter-spacing="1.5" text-anchor="middle" class="m">${esc(fitText(t, abbr.toUpperCase(), 9.5, bw - 24, { letterSpacing: 1.5 }))}</text>`;
      const secs = secOn
        ? `${strip(t, rotate(Array.from({ length: 60 }, (_, i) => pad2(i)), sec), bx + bw / 2, ty + 24, 12, "a b", 60, 0, textWidth(t, "00", 12, { bold: true }) + 2)}
<rect x="${bx + 20}" y="${by + bh - 18}" width="${bw - 40}" height="3" rx="1.5" fill="${t.heat[0]}"/>
<g transform="translate(${bx + 20} 0)"><rect x="0" y="${by + bh - 18}" width="${bw - 40}" height="3" rx="1.5" fill="url(#secG)" style="transform-origin:0 0;transform:scaleX(${(sec / 60).toFixed(3)});animation:secs 60s linear -${sec}s infinite"/></g>`
        : `<text x="${bx + bw / 2}" y="${ty + 24}" font-size="11" text-anchor="middle" class="m">${esc(weekdayName(lp.weekday, true).toUpperCase())}</text>`;
      css += `.colon{animation:colon 1s steps(1) infinite}@keyframes colon{50%{opacity:.25}}@keyframes secs{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
      css += TNUM;
    left = `<g class="in tn" style="${dl(0.1)}">
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.max(6, t.radius)}" fill="${t.raised}" stroke="${t.border}"/>
${ampm}
${hh}
<text x="${f(colonX)}" y="${ty - 2}" font-size="${size}" text-anchor="middle" class="a b h colon loop">:</text>
${mt}${mo}
${secs}
</g>`;
    }

    // ------------------------------------------------------------ right column
    const rx = 196;
    const rw = W - 24 - rx;
    const citySize = fitSize(t, city, 22, rw, 13, { bold: true, heading: true });
    const dateLine = `${weekdayName(lp.weekday)}, ${lp.day} ${monthName(lp.month)}`;
    const offTxt = offsetLabel(off);
    const offW = textWidth(t, offTxt, 10.5, { bold: true }) + 16;
    const rTop = top + 26;
    let band = "";
    if (showDay) {
      const lat = ctx.profile.location.latitude || 0;
      let lon = ctx.profile.location.longitude || 0;
      if (!ctx.profile.location.latitude && !ctx.profile.location.longitude) lon = (off / 60) * 15;
      const doy = yearProgress(lp).dayOfYear;
      const dl0 = daylight(lat, lon, doy, off);
      const by = top + 126;
      const bh = 8;
      const xh = (hr: number) => rx + (((hr % 24) + 24) % 24) / 24 * rw;
      const segs: string[] = [];
      if (dl0.length >= 23.99) segs.push(`<rect x="${rx}" y="${by}" width="${rw}" height="${bh}" rx="${bh / 2}" fill="url(#dayG)"/>`);
      else if (dl0.length > 0.01) {
        const a = xh(dl0.rise);
        const b = xh(dl0.set);
        if (a < b) segs.push(`<rect x="${f(a)}" y="${by}" width="${f(b - a)}" height="${bh}" rx="${bh / 2}" fill="url(#dayG)"/>`);
        else segs.push(`<rect x="${rx}" y="${by}" width="${f(b - rx)}" height="${bh}" rx="${bh / 2}" fill="url(#dayG)"/><rect x="${f(a)}" y="${by}" width="${f(rx + rw - a)}" height="${bh}" rx="${bh / 2}" fill="url(#dayG)"/>`);
      }
      const nowH = h + m / 60 + sec / 3600;
      const nowX = xh(nowH);
      const frac = nowH / 24;
      const p = ((1 - frac) * 100).toFixed(3);
      const p2 = ((1 - frac) * 100 + 0.001).toFixed(3);
      css += `@keyframes sunMove{0%{transform:translateX(0)}${p}%{transform:translateX(${f(rx + rw - nowX)}px)}${p2}%{transform:translateX(${f(rx - nowX)}px)}100%{transform:translateX(0)}}`;
      const isDay = dl0.length >= 23.99 || (dl0.length > 0.01 && (((nowH - dl0.rise) % 24) + 24) % 24 < dl0.length);
      const lenTxt = `${Math.floor(dl0.length)}h ${pad2(Math.round((dl0.length % 1) * 60) % 60)}m`;
      const cap =
        dl0.length >= 23.99 ? "midnight sun · 24h daylight" : dl0.length <= 0.01 ? "polar night · no sunrise" : `${hm(dl0.rise)} – ${hm(dl0.set)} · ${lenTxt}`;
      const ticks = [0, 6, 12, 18, 24]
        .map((hr) => `<text x="${f(rx + (hr / 24) * rw)}" y="${by + 24}" font-size="9" text-anchor="${hr === 0 ? "start" : hr === 24 ? "end" : "middle"}" class="m" opacity=".75">${pad2(hr)}</text>`)
        .join("");
      band = `<g class="in" style="${dl(0.5)}">
${glyph(isDay ? "sparkle" : "moon", rx, by - 22, 12, t.accent)}
<text x="${rx + 18}" y="${by - 12}" font-size="10.5" class="m">${esc(fitText(t, cap, 10.5, rw - 18))}</text>
<rect x="${rx}" y="${by}" width="${rw}" height="${bh}" rx="${bh / 2}" fill="${t.heat[0]}" stroke="${t.border}" stroke-width=".6"/>
${segs.join("")}
${ticks}
<g transform="translate(${f(nowX)} 0)"><g style="animation:sunMove 86400s linear infinite">
<path d="M0 ${by - 4}V${by + bh + 4}" stroke="${t.text}" stroke-width="2" stroke-linecap="round"/>
<circle cx="0" cy="${by + bh / 2}" r="7" fill="${t.glow}" opacity=".35" class="loop" style="animation:pulse 2s ease-in-out infinite"/>
</g></g>
</g>`;
    }
    const right = `<g class="in" style="${dl(0.25)}">
<text x="${rx}" y="${rTop}" font-size="${citySize}" class="t b h">${esc(fitText(t, city, citySize, rw, { bold: true, heading: true }))}</text>
<text x="${rx}" y="${rTop + 20}" font-size="12" class="m">${esc(fitText(t, dateLine, 12, rw))}</text>
<rect x="${rx}" y="${rTop + 32}" width="${f(offW)}" height="20" rx="10" fill="${t.raised}" stroke="${t.border}"/>
<text x="${f(rx + offW / 2)}" y="${rTop + 46}" font-size="10.5" text-anchor="middle" class="t b">${esc(offTxt)}</text>
<text x="${f(rx + offW + 8)}" y="${rTop + 46}" font-size="10.5" class="m">${esc(fitText(t, abbr, 10.5, rw - offW - 8))}</text>
</g>`;
    const defs = `<linearGradient id="dayG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accentDeep(t)}"/><stop offset=".5" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>
<linearGradient id="secG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${left}
${right}
${band}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});

