import { rng } from "../data/mock";
import type { ActivityEvent, EventKind } from "../data/types";
import { localParts, pad2 } from "../lib/astro";
import { esc } from "../lib/escape";
import { card, fitSize, label, svg, textWidth } from "../lib/svg";
import { fitLabel } from "./rhythm";
import { defineWidget } from "./types";

const W = 840;
const CW = 11.5;
const GAP = 1.6;
const CH = 22;
const ROW = 32;
const COL_GAP = 14;
const COLS = [
  { key: "time", label: "TIME", n: 5 },
  { key: "event", label: "EVENT", n: 7 },
  { key: "repo", label: "REPOSITORY", n: 16 },
  { key: "detail", label: "DETAIL", n: 18 },
  { key: "status", label: "STATUS", n: 8 },
] as const;

const KIND: Record<EventKind, [string, string]> = {
  push: ["PUSH", "ON TIME"],
  merge: ["MERGE", "MERGED"],
  pr: ["PR", "BOARDING"],
  review: ["REVIEW", "CHECKED"],
  release: ["RELEASE", "DEPARTED"],
  issue: ["ISSUE", "OPEN"],
  create: ["CREATE", "NEW"],
  star: ["STAR", "STARRED"],
  fork: ["FORK", "FORKED"],
  other: ["EVENT", "—"],
};

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function cells(s: string, n: number): string[] {
  const up = [...s.toUpperCase().replace(/\s+/g, " ")];
  return up.length > n ? up.slice(0, n) : [...up, ...new Array(n - up.length).fill(" ")];
}

export const board = defineWidget({
  type: "board",
  title: "Departure board",
  description: "Your latest public GitHub activity on a split-flap departure board that clatters into place.",
  category: "Activity",
  kind: "svg",
  width: "full",
  needs: ["events"],
  defaults: { title: "departures · latest activity", rows: 6, clock: true, flaps: true },
  fields: [
    { key: "title", label: "Title", type: "text", placeholder: "departures · latest activity" },
    { key: "rows", label: "Rows", type: "number", min: 3, max: 8, help: "Empty slots stay blank when there is less activity." },
    { key: "clock", label: "Clock and handle", type: "toggle", help: "Build time and your GitHub handle in the corner." },
    { key: "flaps", label: "Flap animation", type: "toggle", help: "Letters scramble and flip into place." },
  ],
  alt: () => "recent GitHub activity as a departure board",
  href: (ctx) => `https://github.com/${ctx.profile.login}`,
  render(ctx, o) {
    const t = ctx.theme;
    const tz = ctx.profile.location.timezone;
    const nRows = Math.max(3, Math.min(8, Math.round(Number(o.rows) || 6)));
    const flaps = Boolean(o.flaps);
    const events: ActivityEvent[] = (Array.isArray(ctx.data.events) ? ctx.data.events : []).slice(0, nRows);
    const quiet = events.length === 0;
    const r = rng(99);
    const widths = COLS.map((c) => c.n * (CW + GAP) - GAP);
    const total = widths.reduce((a, b) => a + b, 0) + COL_GAP * (COLS.length - 1);
    const x0 = Math.round((W - total) / 2);
    const colX: number[] = [];
    let cx = x0;
    for (const w of widths) {
      colX.push(cx);
      cx += w + COL_GAP;
    }
    const y0 = 86;
    const H = y0 + nRows * ROW + 34;
    const today = localParts(ctx.date, tz);
    const fs = fitSize(t, "O", 13, CW - 1.5, 9, { bold: true });
    // wide glyphs (W, M, …) shrink individually so they stay inside their flap
    const sizes = new Map<string, number>();
    const sizeOf = (ch: string) => {
      let v = sizes.get(ch);
      if (v === undefined) {
        v = textWidth(t, ch, fs, { bold: true }) > CW - 1 ? fitSize(t, ch, fs, CW - 1, 8, { bold: true }) : fs;
        sizes.set(ch, v);
      }
      return v;
    };
    // light themes need an outline for the flaps to read against the card
    const tileStroke = t.name === "light" ? ` stroke="${t.border}" stroke-width=".8"` : "";
    const out: string[] = [];
    for (let ri = 0; ri < nRows; ri++) {
      const ev = events[ri];
      let values: Record<string, string> | null = null;
      if (ev) {
        const when = new Date(ev.time);
        const valid = !Number.isNaN(when.getTime());
        const lt = valid ? localParts(when, tz) : today;
        const sameDay = lt.year === today.year && lt.month === today.month && lt.day === today.day;
        const [kind, status] = KIND[ev.kind] ?? KIND.other;
        values = {
          time: !valid ? "--:--" : sameDay ? `${pad2(lt.hour)}:${pad2(lt.minute)}` : `${pad2(lt.day)}.${pad2(lt.month)}`,
          event: kind,
          repo: ev.repo || "",
          detail: ev.detail || "",
          status: ri === 0 ? "LATEST" : status,
        };
      } else if (quiet && ri === 0) {
        values = { time: `${pad2(today.hour)}:${pad2(today.minute)}`, event: "", repo: "quiet day", detail: "no public events", status: "STANDBY" };
      }
      const y = y0 + ri * ROW;
      COLS.forEach((col, ci) => {
        const chars = cells(values?.[col.key] ?? "", col.n);
        chars.forEach((ch, k) => {
          const x = colX[ci] + k * (CW + GAP);
          const d = 0.4 + ri * 0.16 + (ci * 6 + k) * 0.012 + r() * 0.25;
          const scramble = SCRAMBLE[Math.floor(r() * SCRAMBLE.length)];
          const tile = `<rect x="${x.toFixed(1)}" y="${y}" width="${CW}" height="${CH}" rx="2" fill="${t.raised}"${tileStroke}/>`;
          const seam = `<rect x="${x.toFixed(1)}" y="${y + CH / 2 - 0.5}" width="${CW}" height="1" fill="${t.card}" opacity=".9"/>`;
          const tx = (x + CW / 2).toFixed(1);
          const ty = (y + CH / 2 + fs * 0.36).toFixed(1);
          if (!values) {
            out.push(`<g class="fade" style="animation-delay:${(0.3 + ri * 0.08).toFixed(2)}s">${tile}${seam}</g>`);
            return;
          }
          const color = col.key === "status" ? (ri === 0 && !quiet ? t.glow : t.accent) : col.key === "time" ? t.muted : t.text;
          const blink = col.key === "status" && ri === 0 && !quiet ? ` class="blink loop" style="animation-delay:${(d + 1).toFixed(2)}s"` : "";
          const glyphText = ch === " " ? "" : `<text x="${tx}" y="${ty}" font-size="${sizeOf(ch)}" text-anchor="middle" class="b" fill="${color}"${flaps ? ` style="animation:on .01s ${d.toFixed(2)}s both"` : ""}><tspan${blink}>${esc(ch)}</tspan></text>`;
          if (!flaps) {
            out.push(`<g class="fade" style="animation-delay:${(0.3 + ri * 0.1 + ci * 0.05).toFixed(2)}s">${tile}${glyphText}${seam}</g>`);
            return;
          }
          out.push(`<g>${tile}<g style="transform-box:fill-box;transform-origin:center;animation:flip .32s ease-out ${d.toFixed(2)}s both">
<text x="${tx}" y="${ty}" font-size="${fs}" text-anchor="middle" class="b m" style="animation:off .01s ${d.toFixed(2)}s both">${scramble}</text>${glyphText}</g>${seam}</g>`);
        });
      });
    }
    const heads = COLS.map((c, i) => `<text x="${colX[i]}" y="${y0 - 10}" font-size="10" letter-spacing="1.5" class="m">${c.label}</text>`).join("");
    const css = `@keyframes flip{0%{transform:scaleY(1)}40%{transform:scaleY(.05)}100%{transform:scaleY(1)}}
@keyframes off{to{opacity:0}}@keyframes on{from{opacity:0}to{opacity:1}}`;

    // header: title on the left, clock + handle on the right (handle dropped when it would collide)
    const right = W - 24;
    let corner = "";
    let cornerW = 0;
    if (o.clock) {
      const clock = `${pad2(ctx.now.hour)}:${pad2(ctx.now.minute)}`;
      const clockW = textWidth(t, clock, 14, { bold: true });
      const handle = `GITHUB.COM/${ctx.profile.login.toUpperCase()}`;
      const handleW = textWidth(t, handle, 10.5, { letterSpacing: 1 });
      const titleW = o.title ? Math.min(textWidth(t, String(o.title).toUpperCase(), 12, { bold: true, letterSpacing: 2 }) + 16, 420) : 0;
      const withHandle = right - clockW - 16 - handleW > 24 + titleW + 24;
      cornerW = clockW + (withHandle ? 16 + handleW : 0);
      corner = `<g class="fade" style="animation-delay:.2s"><text x="${right}" y="31" font-size="14" text-anchor="end" class="t b">${clock}</text>
${withHandle ? `<text x="${(right - clockW - 16).toFixed(1)}" y="31" font-size="10.5" text-anchor="end" letter-spacing="1" class="m">${esc(handle)}</text>` : ""}</g>`;
    }
    const titleMax = W - 48 - (cornerW ? cornerW + 24 : 0);
    const body = `${card(t, { width: W, height: H })}
${o.title ? label(t, 24, 30, fitLabel(t, String(o.title), titleMax)) : ""}
${corner}
${heads}
${out.join("")}
<text x="${x0}" y="${H - 16}" font-size="10" class="m">public events · refreshed nightly</text>`;
    return svg({ width: W, height: H, theme: t, title: "recent GitHub activity as a departure board", css, body });
  },
});
