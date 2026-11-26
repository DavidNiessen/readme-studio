import { esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { card, fitText, svg, textWidth } from "../lib/svg";
import { TNUM, compact, dl, header, optBool, optNum, optPick, optStr } from "./kit-d";
import { accentDeep, glyph, onAccent } from "./parts";
import { defineWidget } from "./types";

const W = 415;
const H = 208;

/** 10, 25, 50, 100, 250, 500, 1k, 2.5k, 5k, 10k, … */
export function milestones(limit: number): number[] {
  const out: number[] = [];
  for (let p = 10; out.length < 40; p *= 10) {
    for (const m of [1, 2.5, 5]) {
      const v = Math.round(p * m);
      out.push(v);
      if (v > limit) return out;
    }
  }
  return out;
}

export function nextMilestone(n: number): { prev: number; next: number } {
  const ms = milestones(Math.max(0, n));
  const next = ms.find((m) => m > n) ?? ms[ms.length - 1];
  const prev = [...ms].reverse().find((m) => m <= n) ?? 0;
  return { prev, next };
}

export const followers = defineWidget({
  type: "followers",
  title: "Follower milestone",
  description: "Your follower count on a rolling counter with a progress bar towards the next milestone.",
  scope: "profile",
  category: "Stats",
  kind: "svg",
  width: "half",
  defaults: { label: "followers", target: "auto", goal: 1000, following: true, ladder: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "target",
      label: "Next milestone",
      type: "segmented",
      options: [
        { value: "auto", label: "Automatic" },
        { value: "manual", label: "Custom goal" },
      ],
    },
    { key: "goal", label: "Goal", type: "number", min: 1, max: 1_000_000, step: 1, when: { key: "target", is: ["manual"] } },
    { key: "following", label: "Following count", type: "toggle" },
    { key: "ladder", label: "Milestone ladder", type: "toggle", help: "Small markers for the milestones around you." },
  ],
  alt: (ctx) => `${ctx.profile.login} follower count`,
  href: (ctx) => `https://github.com/${ctx.profile.login}?tab=followers`,
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const n = Math.max(0, Math.round(ctx.data.followers || 0));
    const manual = optPick(o.target, ["auto", "manual"], "auto") === "manual";
    const auto = nextMilestone(n);
    const goal = manual ? optNum(o.goal, 1000, 1) : auto.next;
    const prev = manual ? 0 : auto.prev;
    const reached = n >= goal;
    const frac = reached ? 1 : Math.max(0, Math.min(1, (n - prev) / Math.max(1, goal - prev)));
    const top = lbl ? 0 : -24;

    const value = groupDigits(n);
    const size = 44;
    const numY = 98 + top;
    const vw = odometerWidth(t, value, size, true, true);
    const unit = n === 1 ? "follower" : "followers";
    const following = optBool(o.following, true);
    const fol = following ? `following ${groupDigits(ctx.data.following || 0)}` : "";

    // goal block (right)
    const goalTxt = groupDigits(goal);
    const goalW = textWidth(t, goalTxt, 20, { bold: true, heading: true });
    const goalBlock = `<g class="in" style="${dl(0.35)}">
<text x="${W - 24}" y="${numY - 26}" font-size="10" letter-spacing="1.2" text-anchor="end" class="m">${reached ? "GOAL REACHED" : manual ? "GOAL" : "NEXT MILESTONE"}</text>
${glyph(reached ? "check" : "trophy", W - 24 - goalW - 22, numY - 15, 16, t.accent)}
<text x="${W - 24}" y="${numY}" font-size="20" text-anchor="end" class="t b h">${esc(goalTxt)}</text>
</g>`;

    // progress bar
    const bx = 24;
    const bw = W - 48;
    const by = numY + 26;
    const bh = 10;
    const fillW = Math.max(bh, bw * frac);
    const pctTxt = `${Math.floor(frac * 100)}%`;
    const pw = textWidth(t, pctTxt, 10.5, { bold: true }) + 14;
    const px = Math.min(Math.max(bx + fillW - pw / 2, bx), bx + bw - pw);
    const bar = `<g class="in" style="${dl(0.45)}">
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${t.heat[0]}" stroke="${t.border}" stroke-width=".6"/>
<clipPath id="fbar"><rect x="${bx}" y="${by}" width="${fillW.toFixed(1)}" height="${bh}" rx="${bh / 2}"/></clipPath>
<g clip-path="url(#fbar)"><rect x="${bx}" y="${by}" width="${fillW.toFixed(1)}" height="${bh}" fill="url(#barG)" class="fill"/>
<rect class="sh loop loop-only" x="${bx}" y="${by}" width="70" height="${bh}" fill="url(#shine)"/></g>
<g class="fade" style="${dl(1.6)}"><rect x="${px.toFixed(1)}" y="${by + bh + 6}" width="${pw.toFixed(1)}" height="18" rx="9" fill="${t.accent}"/>
<text x="${(px + pw / 2).toFixed(1)}" y="${by + bh + 18.5}" font-size="10.5" text-anchor="middle" fill="${onAccent(t)}" class="b">${pctTxt}</text></g>
</g>`;

    // footer: to-go + ladder
    const togo = reached ? `${groupDigits(n - goal)} past your goal` : `${groupDigits(goal - n)} to go`;
    const footY = H - 22 + top;
    let ladder = "";
    if (optBool(o.ladder, true) && !manual) {
      const ms = milestones(goal * 10);
      const idx = ms.indexOf(goal);
      const around = ms.slice(Math.max(0, idx - 3), idx + 2);
      let x = W - 24;
      const chips: string[] = [];
      for (let i = around.length - 1; i >= 0; i--) {
        const m = around[i];
        const txt = compact(m);
        const done = m <= n;
        const isNext = m === goal;
        const w = textWidth(t, txt, 10, { bold: isNext }) + 14;
        x -= w;
        chips.push(
          `<rect x="${x.toFixed(1)}" y="${footY - 12.5}" width="${w.toFixed(1)}" height="17" rx="8.5" fill="${done ? t.raised : "none"}" stroke="${isNext ? t.accent : t.border}"${done || isNext ? "" : ' stroke-dasharray="2 2"'}/><text x="${(x + w / 2).toFixed(1)}" y="${footY - 0.5}" font-size="10" text-anchor="middle" class="${isNext ? "a b" : done ? "t" : "s"}">${txt}</text>`,
        );
        x -= 6;
      }
      ladder = `<g class="fade" style="${dl(1.2)}">${chips.join("")}</g>`;
    }
    const footLeft = [togo, fol].filter(Boolean).join(" · ");
    const css = `${TNUM}.fill{transform-box:fill-box;transform-origin:left;animation:growX 1.6s cubic-bezier(.2,.7,.2,1) .6s both}
.sh{animation:shimmer 3.6s ease-in-out 2.2s infinite}`;
    const defs = `<linearGradient id="barG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accentDeep(t)}"/><stop offset="1" stop-color="${t.glow}"/></linearGradient>`;
    const ladderW = ladder ? 180 : 0;
    const body = `${card(t, { width: W, height: H + top })}
${lbl ? header(t, W, lbl) : ""}
<g class="in" style="${dl(0.15)}">
<g class="tn">${odometer(t, value, { x: 22, y: numY, fontSize: size, delay: 0.3, duration: 2, heading: true })}</g>
<text x="${(24 + vw + 8).toFixed(1)}" y="${numY}" font-size="13" class="m">${esc(fitText(t, unit, 13, Math.max(40, W - 24 - 160 - vw - 8)))}</text>
</g>
${goalBlock}
${bar}
<text x="24" y="${footY}" font-size="11.5" class="m fade" style="${dl(1.3)}">${esc(fitText(t, footLeft, 11.5, W - 48 - ladderW))}</text>
${ladder}`;
    return svg({ width: W, height: H + top, theme: t, title: `${n} followers`, css, defs, body });
  },
});
