import type { ContributionDay } from "../data/types";
import { mix } from "../lib/color";
import { esc, groupDigits } from "../lib/escape";
import { card, fitText, label, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { niceDate } from "./contrib";
import { defineWidget, type Ctx, type GifFrames, type Options } from "./types";

const W = 840;
const H = 420;
const SPIN_FRAMES = 36;
const SWAY_FRAMES = 32;
const TOP = 56;
const BOTTOM = 44;

type V3 = [number, number, number];
type Bounds = [number, number, number, number];

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export interface Fit {
  scale: number;
  ox: number;
  oy: number;
}

/** Tower top colours per contribution level. */
function ramp(t: Theme, mode: string): string[] {
  if (mode !== "accent") return [...t.heat];
  const base = t.name === "dark" ? t.raised : mix(t.raised, "#000000", 0.06);
  return [base, mix(base, t.accent, 0.38), mix(base, t.accent, 0.62), t.accent, t.glow];
}

interface Scene {
  faces: { d: number; pts: string; fill: string }[];
  plate: string;
  bounds: Bounds;
}

/** Project the isometric contribution city, rotated by `angle` radians around its centre. */
function scene(weeks: ContributionDay[][], colors: string[], angle: number, fit: Fit): Scene {
  const cols = Math.max(1, weeks.length);
  const max = Math.max(1, ...weeks.flat().map((d) => d.count));
  const unit = 13;
  const gap = 2.4;
  const elev = (28 * Math.PI) / 180;
  const cx = (cols * unit) / 2;
  const cz = (7 * unit) / 2;
  const { scale, ox, oy } = fit;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const ce = Math.cos(elev);
  const se = Math.sin(elev);
  // world: x along weeks, z along weekdays, y up; the camera looks down by `elev`
  const project = ([x, y, z]: V3): V3 => {
    const px = x - cx;
    const pz = z - cz;
    const rx = px * ca - pz * sa;
    const rz = px * sa + pz * ca;
    return [ox + rx * scale, oy + (-y * ce + rz * se) * scale, rz * ce + y * se];
  };
  const faces: Scene["faces"] = [];
  weeks.forEach((w, c) =>
    w.forEach((day) => {
      const r = day.weekday;
      const h = day.count === 0 ? 0.8 : 3 + (day.count / max) * 150;
      const x0 = c * unit + gap / 2;
      const x1 = (c + 1) * unit - gap / 2;
      const z0 = r * unit + gap / 2;
      const z1 = (r + 1) * unit - gap / 2;
      const top = colors[day.level] ?? colors[0];
      const p = (
        [
          [x0, 0, z0],
          [x1, 0, z0],
          [x1, 0, z1],
          [x0, 0, z1],
          [x0, h, z0],
          [x1, h, z0],
          [x1, h, z1],
          [x0, h, z1],
        ] as V3[]
      ).map(project);
      const quads: [number[], string, V3][] = [
        [[4, 5, 6, 7], top, [0, 1, 0]],
        [[0, 1, 5, 4], shade(top, 0.62), [0, 0, -1]],
        [[2, 3, 7, 6], shade(top, 0.62), [0, 0, 1]],
        [[1, 2, 6, 5], shade(top, 0.8), [1, 0, 0]],
        [[3, 0, 4, 7], shade(top, 0.8), [-1, 0, 0]],
      ];
      for (const [idx, fill, nrm] of quads) {
        // back-face cull with the rotated normal's depth component
        const nz = nrm[0] * sa + nrm[2] * ca;
        if (nrm[1] === 0 && nz > 0) continue;
        if (nrm[1] === 0 && h < 1) continue; // flat tiles only need their top
        const depth = idx.reduce((a, i) => a + p[i][2], 0) / 4;
        faces.push({ d: depth, pts: idx.map((i) => `${p[i][0].toFixed(1)},${p[i][1].toFixed(1)}`).join(" "), fill });
      }
    }),
  );
  faces.sort((a, b) => b.d - a.d);
  const m = unit * 0.6;
  const platePts = (
    [
      [-m, -m],
      [cols * unit + m, -m],
      [cols * unit + m, 7 * unit + m],
      [-m, 7 * unit + m],
    ] as [number, number][]
  ).map(([x, z]) => project([x, -0.5, z]));
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (x: number, y: number) => {
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  };
  platePts.forEach(([x, y]) => grow(x, y));
  for (const f of faces) for (const pt of f.pts.split(" ")) grow(...(pt.split(",").map(Number) as [number, number]));
  return { faces, plate: platePts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "), bounds };
}

/** Camera fit so the city stays inside the frame at every angle. */
function fitAll(list: Bounds[]): Fit {
  const [x0, y0, x1, y1] = list.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const pad = 24;
  const scale = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - TOP - BOTTOM) / Math.max(1, y1 - y0));
  return { scale, ox: W / 2 - (scale * (x0 + x1)) / 2, oy: TOP + (H - TOP - BOTTOM) / 2 - (scale * (y0 + y1)) / 2 };
}

function angles(o: Options): number[] {
  if (o.rotation === "sway") return Array.from({ length: SWAY_FRAMES }, (_, i) => 0.5 + 0.42 * Math.sin((i / SWAY_FRAMES) * Math.PI * 2));
  return Array.from({ length: SPIN_FRAMES }, (_, i) => (i / SPIN_FRAMES) * Math.PI * 2 + 0.5);
}

interface Prepared {
  weeks: ContributionDay[][];
  colors: string[];
  fit: Fit;
  list: number[];
}

function prepare(ctx: Ctx, o: Options): Prepared {
  const weeks = ctx.data.weeks.slice(-53);
  const colors = ramp(ctx.theme, String(o.color));
  const list = angles(o);
  const unit: Fit = { scale: 1, ox: 0, oy: 0 };
  // fit over a full turn (or the sway range) so the camera never jumps
  const probe = o.rotation === "sway" ? list : Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2);
  const fit = fitAll(probe.map((a) => scene(weeks, colors, a, unit).bounds));
  return { weeks, colors, fit, list };
}

function frameSvg(ctx: Ctx, o: Options, p: Prepared, angle: number, animated: boolean): string {
  const t = ctx.theme;
  const sc = scene(p.weeks, p.colors, angle, p.fit);
  const total = groupDigits(ctx.data.lastYearTotal);
  const b = ctx.d.best;
  const lbl = String(o.label ?? "");
  const right = `${total} contributions · 1 tower = 1 day`;
  const rightMax = W - 48 - (lbl ? textWidth(t, lbl.toUpperCase(), 12, { bold: true, letterSpacing: 2 }) + 40 : 0);
  const best = b && b.count ? `tallest tower · ${b.count} on ${niceDate(b.date)}` : "no contributions yet · the city is still being planned";
  const legend = p.colors.map((c, i) => `<rect x="${W - 132 + i * 14}" y="${H - 28}" width="11" height="11" rx="2.5" fill="${c}"/>`).join("");
  const city = sc.faces.map((f) => `<polygon points="${f.pts}" fill="${f.fill}" stroke="${f.fill}" stroke-width=".6" stroke-linejoin="round"/>`).join("");
  const body = `${card(t, { width: W, height: H })}
${lbl ? label(t, 24, 30, lbl) : ""}
${rightMax > 120 ? `<text x="${W - 24}" y="30" font-size="12" text-anchor="end" class="m"><tspan class="t b" font-size="14">${esc(total)}</tspan>${esc(fitText(t, right.slice(total.length), 12, rightMax - textWidth(t, total, 14, { bold: true })))}</text>` : ""}
<polygon points="${sc.plate}" fill="${t.raised}" stroke="${t.border}"/>
<g${animated ? ` class="fade" style="animation-delay:.2s"` : ""}>${city}</g>
<text x="24" y="${H - 18.5}" font-size="10.5" class="m">${esc(fitText(t, best, 10.5, W - 200))}</text>
<text x="${W - 140}" y="${H - 18.5}" font-size="10.5" text-anchor="end" class="m">less</text>${legend}<text x="${W - 58}" y="${H - 18.5}" font-size="10.5" class="m">more</text>`;
  return svg({ width: W, height: H, theme: t, title: "3D contribution skyline", body });
}

export const skyline = defineWidget({
  type: "skyline",
  title: "3D skyline",
  description: "Your last 12 months as an isometric city of contribution towers, slowly turning in an animated GIF.",
  scope: "profile",
  category: "Activity",
  kind: "gif",
  width: "full",
  needs: ["calendar"],
  defaults: { label: "3d skyline · last 12 months", rotation: "spin", color: "heat" },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "rotation",
      label: "Motion",
      type: "segmented",
      options: [
        { value: "spin", label: "Full spin" },
        { value: "sway", label: "Gentle sway" },
      ],
    },
    {
      key: "color",
      label: "Tower colours",
      type: "segmented",
      options: [
        { value: "heat", label: "Heat scale" },
        { value: "accent", label: "Accent" },
      ],
    },
  ],
  alt: () => "3D contribution skyline",
  href: (ctx) => `https://github.com/${ctx.profile.login}`,
  render(ctx, o) {
    const p = prepare(ctx, o);
    return frameSvg(ctx, o, p, o.rotation === "sway" ? 0.5 : 0.5, true);
  },
  frames(ctx, o): GifFrames {
    const p = prepare(ctx, o);
    const delay = o.rotation === "sway" ? 110 : 100;
    return { width: W, height: H, frames: p.list.map((a) => ({ svg: frameSvg(ctx, o, p, a, false), delay })) };
  },
});
