import type { Weather } from "../data/types";
import { moonPhase, weekdayName, yearProgress, type LocalDate } from "../lib/astro";
import { esc, num } from "../lib/escape";
import { card, EASE, fitSize, fitText, label, svg, textWidth, wrapText } from "../lib/svg";
import type { Theme } from "../theme";
import { moonGlyph } from "./parts";
import { fitLabel } from "./rhythm";
import { defineWidget } from "./types";

const W = 415;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

/** Map WMO weather codes to a small set of illustrated kinds. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 57) return "drizzle";
  if (code <= 67 || (code >= 80 && code <= 82)) return "rain";
  if (code <= 77 || code === 85 || code === 86) return "snow";
  return "storm";
}

export function weatherLabel(kind: WeatherKind): string {
  return {
    clear: "Clear sky",
    partly: "Partly cloudy",
    cloudy: "Overcast",
    fog: "Foggy",
    drizzle: "Drizzle",
    rain: "Rain",
    snow: "Snow",
    storm: "Thunderstorm",
  }[kind];
}

/** Small animated weather illustration centred on (x, y). */
export function weatherIcon(t: Theme, kind: WeatherKind, x: number, y: number, isDay: boolean): string {
  const sun = isDay
    ? `<g class="loop" style="transform-origin:${x}px ${y}px;animation:spin 12s linear infinite">${Array.from({ length: 8 }, (_, i) => `<line x1="${x}" y1="${y - 15}" x2="${x}" y2="${y - 19}" stroke="${t.glow}" stroke-width="2" stroke-linecap="round" transform="rotate(${i * 45} ${x} ${y})"/>`).join("")}</g><circle cx="${x}" cy="${y}" r="10" fill="${t.glow}"/>`
    : `<path d="M${x + 6} ${y - 12}a12 12 0 1 0 8 18a9.5 9.5 0 0 1-8-18z" fill="${t.text}"/>`;
  const cloud = (cx: number, cy: number, fill: string) =>
    `<g class="loop" style="animation:drift 6s ease-in-out infinite alternate"><path d="M${cx - 16} ${cy + 8}h30a8 8 0 0 0 0-16a11 11 0 0 0-21-3a8 8 0 0 0-9 19z" fill="${fill}"/></g>`;
  const drops = (n: number, snow: boolean) =>
    Array.from({ length: n }, (_, i) => {
      const dx = x - 10 + i * 8;
      return snow
        ? `<circle cx="${dx}" cy="${y + 16}" r="1.8" fill="${t.text}" class="loop" style="animation:fall 1.8s linear ${(i * 0.4).toFixed(1)}s infinite"/>`
        : `<line x1="${dx}" y1="${y + 12}" x2="${dx - 2}" y2="${y + 18}" stroke="${t.accent}" stroke-width="1.6" stroke-linecap="round" class="loop" style="animation:fall .9s linear ${(i * 0.25).toFixed(2)}s infinite"/>`;
    }).join("");
  switch (kind) {
    case "clear":
      return sun;
    case "partly":
      return `<g transform="translate(-6 -6)">${sun}</g>${cloud(x + 4, y + 4, t.muted)}`;
    case "cloudy":
    case "fog":
      return `${cloud(x - 4, y - 2, t.subtle)}${cloud(x + 4, y + 4, t.muted)}`;
    case "drizzle":
    case "rain":
      return `${cloud(x, y - 2, t.muted)}${drops(kind === "rain" ? 4 : 2, false)}`;
    case "snow":
      return `${cloud(x, y - 2, t.muted)}${drops(4, true)}`;
    case "storm":
      return `${cloud(x, y - 2, t.muted)}<path d="M${x + 1} ${y + 6}l-5 9h5l-3 8 9-11h-5l3-6z" fill="${t.glow}" class="loop" style="animation:pulse 1.2s steps(2) infinite"/>`;
  }
}

/** ISO-8601 week number of a local calendar date. */
export function isoWeek(n: LocalDate): number {
  const d = new Date(Date.UTC(n.year, n.month - 1, n.day));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - y0) / 86_400_000 + 1) / 7);
}

export const DEFAULT_QUOTES: { text: string; author: string }[] = [
  { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
  { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
  { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
  { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
  { text: "The best error message is the one that never shows up.", author: "Thomas Fuchs" },
  { text: "Deleted code is debugged code.", author: "Jeff Sickel" },
  { text: "Code never lies, comments sometimes do.", author: "Ron Jeffries" },
  { text: "Simple things should be simple, complex things should be possible.", author: "Alan Kay" },
  { text: "The most disastrous thing that you can ever learn is your first programming language.", author: "Alan Kay" },
];

interface Quote {
  text: string;
  author: string;
}

function quotesOf(v: unknown): Quote[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
    .map((q) => ({ text: String(q.text ?? "").trim(), author: String(q.author ?? "").trim() }))
    .filter((q) => q.text);
}

function temp(c: number, unit: string): number {
  return unit === "f" ? (c * 9) / 5 + 32 : c;
}

export const today = defineWidget({
  type: "today",
  title: "Today",
  description: "Today at a glance: the date, the moon phase, local weather, the year so far and a quote of the day.",
  category: "Content",
  kind: "svg",
  width: "half",
  needs: ["weather"],
  defaults: { label: "today", weather: true, moon: true, quote: true, quotes: DEFAULT_QUOTES, unit: "c" },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "today", help: "Your city from the profile is appended." },
    { key: "weather", label: "Weather", type: "toggle", help: "Current conditions for the location in your profile." },
    { key: "unit", label: "Temperature", type: "segmented", options: [{ value: "c", label: "°C" }, { value: "f", label: "°F" }], when: { key: "weather", is: [true] } },
    { key: "moon", label: "Moon phase", type: "toggle" },
    { key: "quote", label: "Quote of the day", type: "toggle", help: "A different quote from the list each day." },
    {
      key: "quotes",
      label: "Quotes",
      type: "list",
      itemLabel: "Quote",
      titleKey: "text",
      max: 60,
      newItem: { text: "", author: "" },
      item: [
        { key: "text", label: "Quote", type: "text", multiline: true, max: 160 },
        { key: "author", label: "Author", type: "text", max: 60 },
      ],
      when: { key: "quote", is: [true] },
    },
  ],
  alt: (ctx) => `today${ctx.profile.location.city ? ` in ${ctx.profile.location.city}` : ""}: date, moon, weather and quote`,
  render(ctx, o) {
    const t = ctx.theme;
    const n = ctx.now;
    const unit = o.unit === "f" ? "f" : "c";
    const moon = moonPhase(ctx.date);
    const yp = yearProgress(n);
    const quotes = o.quote ? quotesOf(o.quotes) : [];
    const q = quotes.length ? quotes[(yp.dayOfYear + n.year) % quotes.length] : null;
    const H = q ? 300 : 232;
    const city = ctx.profile.location.city;

    // ---------------------------------------------------------------- date block
    const day = String(n.day).padStart(2, "0");
    const daySize = 72;
    const dayW = textWidth(t, day, daySize, { bold: true, heading: true, letterSpacing: -3 });
    const dx = Math.round(22 + dayW + 14);
    const l1 = `${MONTHS[n.month - 1]} ${n.year}`;
    const l2 = weekdayName(n.weekday).toUpperCase();
    const l3 = `day ${yp.dayOfYear} · wk ${isoWeek(n)}`;
    const dateRight = dx + Math.max(textWidth(t, l1, 15, { bold: true }), textWidth(t, l2, 11, { letterSpacing: 1 }), textWidth(t, l3, 11));

    // ---------------------------------------------------------------- moon (right aligned, shrinks to fit)
    let moonMarkup = "";
    if (o.moon) {
      const r = 22;
      const pct = `${num(moon.illumination * 100, 0)}%`;
      const full = moon.name.toLowerCase();
      const short = full.split(" ").slice(-1)[0];
      const room = (name: string) => W - 24 - Math.max(textWidth(t, pct, 11, { bold: true }), textWidth(t, name, 9.5)) - 12 - 2 * r - (dateRight + 16);
      const name = room(full) >= 0 ? full : room(short) >= 0 ? short : "";
      const textW = name ? Math.max(textWidth(t, pct, 11, { bold: true }), textWidth(t, name, 9.5)) : 0;
      const tx = W - 24 - textW;
      const mcx = Math.round(name ? tx - 12 - r : W - 24 - r);
      moonMarkup = `<g class="in" style="animation-delay:.35s">
${moonGlyph(t, mcx, 86, r, moon.phase)}
${name ? `<text x="${tx.toFixed(1)}" y="82" font-size="11" class="t b">${pct}</text><text x="${tx.toFixed(1)}" y="97" font-size="9.5" class="m">${esc(name)}</text>` : ""}
</g>`;
    }

    // ---------------------------------------------------------------- weather or year line
    const w: Weather | null = o.weather ? ctx.data.weather : null;
    let mid: string;
    if (w && Number.isFinite(w.temperature)) {
      const kind = weatherKind(w.code);
      const tempText = `${num(temp(w.temperature, unit), 1)}°`;
      const tempSize = 26;
      const hi = `↑ ${Math.round(temp(w.max, unit))}°  ↓ ${Math.round(temp(w.min, unit))}°`;
      const wind = unit === "f" ? `wind ${Math.round(w.wind * 0.621)} mph` : `wind ${Math.round(w.wind)} km/h`;
      const rightW = Math.max(textWidth(t, hi, 11), textWidth(t, wind, 11));
      const leftMax = W - 24 - rightW - 16 - 80;
      mid = `<g class="in" style="animation-delay:.5s">${weatherIcon(t, kind, 46, 172, w.isDay)}
<text x="80" y="170" font-size="${fitSize(t, tempText, tempSize, leftMax, 16, { bold: true, heading: true })}" class="t b h">${esc(tempText)}</text>
<text x="80" y="189" font-size="10.5" class="m">${esc(fitText(t, weatherLabel(kind), 10.5, leftMax))}</text>
<text x="${W - 24}" y="166" font-size="11" text-anchor="end" class="m">${esc(hi)}</text>
<text x="${W - 24}" y="184" font-size="11" text-anchor="end" class="m">${esc(wind)}</text></g>`;
    } else {
      const line = `${n.year} is ${num(yp.fraction * 100, 1)}% done. Make it count.`;
      mid = `<g class="in" style="animation-delay:.5s"><text x="24" y="166" font-size="10.5" letter-spacing="1" class="m">YEAR PROGRESS</text>
<text x="24" y="186" font-size="12.5" class="t">${esc(fitText(t, line, 12.5, W - 48))}</text></g>`;
    }

    // ---------------------------------------------------------------- quote
    let quoteMarkup = "";
    if (q) {
      const lines = wrapText(t, `“${q.text}”`, 11.5, W - 48, 2);
      const author = q.author ? `— ${q.author}` : "";
      quoteMarkup = `<path d="M24 226H${W - 24}" stroke="${t.border}" stroke-dasharray="2 4"/>
${lines.map((l, i) => `<text x="24" y="${250 + i * 17}" font-size="11.5" class="t fade" style="animation-delay:${(0.9 + i * 0.15).toFixed(2)}s">${esc(l)}</text>`).join("")}
${author ? `<text x="${W - 24}" y="${H - 14}" font-size="10" text-anchor="end" class="a fade" style="animation-delay:1.3s">${esc(fitText(t, author, 10, W - 48))}</text>` : ""}`;
    }

    const css = `@keyframes drift{from{transform:translateX(-3px)}to{transform:translateX(3px)}}
@keyframes fall{from{transform:translateY(-4px);opacity:1}to{transform:translateY(8px);opacity:0}}
.yp{transform-box:fill-box;transform-origin:left;animation:growX 1.6s ${EASE} .6s both}`;
    const head = o.label ? `${String(o.label)}${city ? ` · ${city}` : ""}` : "";
    const body = `${card(t, { width: W, height: H })}
${head ? label(t, 24, 30, fitLabel(t, head, W - 48)) : ""}
<g class="in" style="animation-delay:.15s">
<text x="22" y="112" font-size="${daySize}" class="t b h" letter-spacing="-3">${day}</text>
<text x="${dx}" y="78" font-size="15" class="a b">${l1}</text>
<text x="${dx}" y="98" font-size="11" class="m" letter-spacing="1">${esc(l2)}</text>
<text x="${dx}" y="114" font-size="11" class="m">${esc(l3)}</text>
</g>
${moonMarkup}
<path d="M24 136H${W - 24}" stroke="${t.border}"/>
${mid}
<rect x="24" y="206" width="${W - 48}" height="4" rx="2" fill="${t.raised}"/>
<rect class="yp" x="24" y="206" width="${((W - 48) * yp.fraction).toFixed(1)}" height="4" rx="2" fill="url(#accentGrad)"/>
${quoteMarkup}`;
    return svg({ width: W, height: H, theme: t, title: "today: date, moon, weather and quote", css, body });
  },
});
