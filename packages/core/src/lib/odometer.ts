import type { Theme } from "../theme";
import { esc } from "./escape";
import { EASE, textWidth } from "./svg";

export interface OdometerOptions {
  x: number;
  /** text baseline */
  y: number;
  fontSize: number;
  className?: string;
  anchor?: "start" | "middle" | "end";
  /** seconds */
  delay?: number;
  duration?: number;
  /** full extra spins before landing, per column */
  spins?: number;
  bold?: boolean;
  heading?: boolean;
  /** render the final value without the rolling animation */
  static?: boolean;
}

let uid = 0;

/** Rendered width of an odometer value (for placing units after it). */
export function odometerWidth(t: Theme, value: string, fontSize: number, bold = true, heading = false): number {
  const adv = textWidth(t, "0", fontSize, { bold, heading });
  let w = 0;
  for (const c of value) w += c === " " ? adv * 0.45 : /\d/.test(c) ? adv : textWidth(t, c, fontSize, { bold, heading });
  return w;
}

/**
 * Rolling-digit counter. Each digit is a vertical strip of 0-9 (repeated)
 * inside a clip window that slides into place via a CSS `roll` keyframe.
 * Non-digit characters (separators, units) are rendered statically.
 */
export function odometer(t: Theme, value: string, o: OdometerOptions): string {
  const { fontSize, className = "t b", anchor = "start", delay = 0, duration = 1.8, spins = 1, bold = true, heading = false } = o;
  const cls = heading ? `${className} h` : className;
  const adv = textWidth(t, "0", fontSize, { bold, heading });
  const lineH = fontSize * 1.25;
  const chars = [...value];
  const advOf = (c: string) => (c === " " ? adv * 0.45 : /\d/.test(c) ? adv : textWidth(t, c, fontSize, { bold, heading }));
  const offsets: number[] = [];
  let width = 0;
  for (const c of chars) {
    offsets.push(width);
    width += advOf(c);
  }
  const x0 = anchor === "start" ? o.x : anchor === "middle" ? o.x - width / 2 : o.x - width;
  if (o.static || t.motion === "off") {
    return `<text x="${x0.toFixed(1)}" y="${o.y}" font-size="${fontSize}" class="${cls}">${esc(value)}</text>`;
  }
  const id = `odo${uid++}`;
  const top = o.y - fontSize * 0.95;
  const cols: string[] = [];
  let di = 0;
  chars.forEach((c, i) => {
    const cx = x0 + offsets[i];
    if (c === " " || c === " ") return;
    if (!/\d/.test(c)) {
      cols.push(`<text x="${cx.toFixed(1)}" y="${o.y}" font-size="${fontSize}" class="${cls}">${esc(c)}</text>`);
      return;
    }
    const d = Number(c);
    const loops = spins + (di % 2);
    const strip: string[] = [];
    const total = (loops + 1) * 10;
    for (let k = 0; k < total; k++) {
      strip.push(`<text x="${cx.toFixed(1)}" y="${(o.y + k * lineH).toFixed(1)}" font-size="${fontSize}" class="${cls}">${k % 10}</text>`);
    }
    const shift = -(loops * 10 + d) * lineH;
    const colDelay = delay + di * 0.08;
    cols.push(`<g style="--y:${shift.toFixed(1)}px;animation:roll ${duration}s ${EASE} ${colDelay.toFixed(2)}s both">${strip.join("")}</g>`);
    di++;
  });
  return `<clipPath id="${id}"><rect x="${(x0 - 2).toFixed(1)}" y="${top.toFixed(1)}" width="${(width + 4).toFixed(1)}" height="${lineH.toFixed(1)}"/></clipPath><g clip-path="url(#${id})">${cols.join("")}</g>`;
}
