import { contrast } from "../lib/color";
import { esc } from "../lib/escape";
import { hasIcon, icon, iconSvg } from "../lib/icons";
import { card, fitText, label, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { defineWidget } from "./types";

const W = 840;
/** Orbit radii and chip capacity per ring, by number of rings. */
const LAYOUTS: { radii: number[]; caps: number[] }[] = [
  { radii: [100], caps: [12] },
  { radii: [84, 140], caps: [9, 14] },
  { radii: [74, 118, 162], caps: [8, 12, 16] },
];
const PERIODS = [34, 52, 74];
const CHIP = 18;
const LEGEND_W = 360;

interface Ring {
  label: string;
  icons: string[];
}

/** Brand colour when it reads on the chip surface, else the text colour. */
function chipColor(t: Theme, id: string): string {
  const c = icon(id).color;
  if (!c) return "brand";
  return contrast(c, t.raised) < 1.7 ? t.text : c;
}

/** Display name for an icon id; unknown ids keep what the user typed. */
const toolName = (id: string) => (hasIcon(id) || hasIcon(id.toLowerCase().replace(/[^a-z0-9]/g, "")) ? icon(id).title : id);

function rings(o: Record<string, unknown>): Ring[] {
  const list = Array.isArray(o.rings) ? o.rings : [];
  const valid = list.filter((r): r is Record<string, unknown> => !!r && typeof r === "object").slice(0, 3);
  const caps = LAYOUTS[Math.max(0, valid.length - 1)].caps;
  return valid.map((r, i) => ({
    label: typeof r.label === "string" ? r.label : "",
    icons: (Array.isArray(r.icons) ? r.icons : []).filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, caps[i]),
  }));
}

/** Wrap tool names into lines between items (never leaving a dangling separator). */
function wrapNames(t: Theme, names: string[], size: number, max: number, maxLines: number): string[] {
  const o = { bold: true };
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < names.length; i++) {
    const next = cur ? `${cur} · ${names[i]}` : names[i];
    if (textWidth(t, next, size, o) <= max || !cur) {
      cur = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      lines.push(fitText(t, `${cur} · ${names.slice(i).join(" · ")}`, size, max, o));
      return lines;
    }
    lines.push(cur);
    cur = names[i];
  }
  if (cur) lines.push(fitText(t, cur, size, max, o));
  return lines;
}

export const stack = defineWidget({
  type: "stack",
  title: "Tech stack orbit",
  description: "Your tools as a little solar system: up to three rings of brand icons orbiting a centre emblem.",
  category: "Identity",
  kind: "svg",
  width: "full",
  defaults: {
    label: "tech stack · orbit",
    emblem: "github",
    legend: true,
    rings: [
      { label: "Languages", icons: ["typescript", "python", "go"] },
      { label: "Frameworks", icons: ["react", "nextjs", "nodejs", "tailwindcss"] },
      { label: "Infra & data", icons: ["docker", "kubernetes", "aws", "postgresql", "githubactions"] },
    ],
  },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "emblem", label: "Centre emblem", type: "icon" },
    { key: "legend", label: "Ring legend", type: "toggle", help: "Lists each ring's tools beside the orbit." },
    {
      key: "rings",
      label: "Rings",
      type: "list",
      itemLabel: "Ring",
      titleKey: "label",
      max: 3,
      newItem: { label: "Tools", icons: ["git", "linux"] },
      item: [
        { key: "label", label: "Ring name", type: "text", placeholder: "Backend", max: 32 },
        { key: "icons", label: "Icons", type: "tags", placeholder: "rust", max: 16, help: "Icon ids such as typescript, react, docker. Inner rings hold fewer icons than outer ones." },
      ],
    },
  ],
  alt: (_ctx, o) => {
    const names = rings(o).flatMap((r) => r.icons.map(toolName));
    return names.length ? `tech stack: ${names.join(", ")}` : "tech stack orbit";
  },
  render(ctx, o) {
    const t = ctx.theme;
    const rs = rings(o);
    const showLegend = o.legend !== false && rs.length > 0;
    const layout = LAYOUTS[Math.max(0, rs.length - 1)];
    const RADII = layout.radii;
    const rMax = RADII[RADII.length - 1];
    const top = 18;
    const CY = top + rMax + CHIP;
    const CX = showLegend ? W - 32 - rMax - CHIP - 36 : W / 2;
    const orbitH = CY + rMax + CHIP + 18;

    // legend blocks: measured first, then centred in the space below the label
    const blocks: { h: number; draw: (y: number) => string }[] = [];
    if (showLegend) {
      rs.forEach((ring, i) => {
        const lines = ring.icons.length ? wrapNames(t, ring.icons.map(toolName), 15, LEGEND_W, 2) : ["no tools yet"];
        const head = fitText(t, `0${i + 1} — ${ring.label || `ring ${i + 1}`}`.toUpperCase(), 11, LEGEND_W, { bold: true, letterSpacing: 2 });
        const barDy = 24 + (lines.length - 1) * 20 + 14;
        blocks.push({
          h: barDy + 20,
          draw: (y) => `<g class="in" style="animation-delay:${(0.4 + i * 0.15).toFixed(2)}s">
<text x="24" y="${y}" font-size="11" letter-spacing="2" class="a b">${esc(head)}</text>
${lines.map((l, k) => `<text x="24" y="${y + 24 + k * 20}" font-size="15" class="${ring.icons.length ? "t" : "m"} b">${esc(l)}</text>`).join("")}
<rect x="24" y="${y + barDy}" width="${36 + i * 30}" height="3" rx="1.5" fill="url(#accentGrad)"/>
<text x="24" y="${y + barDy + 20}" font-size="10.5" class="m">ring ${i + 1} · ${ring.icons.length} tool${ring.icons.length === 1 ? "" : "s"} · orbit ${PERIODS[i]}s</text>
</g>`,
        });
      });
    }
    const GAP = 34;
    const legendH = blocks.reduce((a, b) => a + b.h, 0) + GAP * Math.max(0, blocks.length - 1);
    const areaTop = o.label ? 52 : 18;
    const H = Math.max(orbitH, areaTop + legendH + 40, 220);
    // first baseline sits ~10px below the block's visual top
    let ly = areaTop + Math.max(0, (H - 18 - areaTop - legendH) / 2) + 10;
    const legendParts = blocks.map((b) => {
      const out = b.draw(ly);
      ly += b.h + GAP;
      return out;
    });

    const css =
      rs
        .map((_, i) => {
          const dir = i % 2 === 0 ? "spin" : "spinR";
          const back = i % 2 === 0 ? "spinR" : "spin";
          return `.r${i}{transform-origin:${CX}px ${CY}px;animation:${dir} ${PERIODS[i]}s linear infinite}.c${i}{transform-box:fill-box;transform-origin:center;animation:${back} ${PERIODS[i]}s linear infinite}`;
        })
        .join("") +
      `
.core{transform-box:fill-box;transform-origin:center;animation:corePulse 3s ease-in-out infinite}
@keyframes corePulse{0%,100%{opacity:.25;transform:scale(.85)}50%{opacity:.55;transform:scale(1.15)}}
.halo{transform-box:fill-box;transform-origin:center;animation:haloOut 3s ease-out infinite}
@keyframes haloOut{from{opacity:.6;transform:scale(.6)}to{opacity:0;transform:scale(1.6)}}`;

    const orbits = rs
      .map((ring, i) => {
        const r = RADII[i];
        const n = ring.icons.length;
        const offset = i * 37;
        const chips = ring.icons
          .map((id, j) => {
            const a = ((offset + (j * 360) / n) * Math.PI) / 180;
            const x = CX + r * Math.sin(a);
            const y = CY - r * Math.cos(a);
            return `<g class="c${i} loop"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${CHIP}" fill="${t.raised}" stroke="${t.border}"/>${iconSvg(id, x - 10, y - 10, 20, chipColor(t, id))}</g>`;
          })
          .join("");
        const comet = `<circle cx="${CX}" cy="${CY - r}" r="2.6" fill="${t.glow}" filter="url(#glow)" class="loop-only"/>`;
        return `<circle cx="${CX}" cy="${CY}" r="${r}" stroke="${t.subtle}" stroke-dasharray="${i === 1 ? "1 6" : "4 6"}" class="fade" style="animation-delay:${(0.2 + i * 0.15).toFixed(2)}s"/>
<g class="fade" style="animation-delay:${(0.35 + i * 0.15).toFixed(2)}s"><g class="r${i} loop">${comet}${chips}</g></g>`;
      })
      .join("\n");

    const emblem = String(o.emblem || "github");
    const empty = rs.length
      ? ""
      : `<text x="${CX}" y="${CY + 64}" font-size="12" text-anchor="middle" class="m">no tools listed yet</text>`;
    const body = `${card(t, { width: W, height: H })}
${o.label ? label(t, 24, 30, String(o.label)) : ""}
${legendParts.join("")}
${orbits}
<circle class="halo loop loop-only" cx="${CX}" cy="${CY}" r="34" stroke="${t.accent}" stroke-width="1.5"/>
<circle class="core loop" cx="${CX}" cy="${CY}" r="38" fill="${t.accent}" opacity=".35" filter="url(#softglow)"/>
<circle cx="${CX}" cy="${CY}" r="30" fill="${t.raised}" stroke="${t.border}"/>
${iconSvg(emblem, CX - 15, CY - 15, 30, chipColor(t, emblem))}
${empty}`;
    return svg({ width: W, height: H, theme: t, title: "tech stack orbit", css, body });
  },
});
