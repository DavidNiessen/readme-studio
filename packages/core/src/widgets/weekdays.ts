import { weekdayName } from "../lib/astro";
import { esc, groupDigits } from "../lib/escape";
import { card, fitText, svg, textWidth } from "../lib/svg";
import { dl, header, optPick, optStr } from "./kit-d";
import { accentDeep } from "./parts";
import { defineWidget } from "./types";

const W = 415;

export const weekdays = defineWidget({
  type: "weekdays",
  title: "Weekday rhythm",
  description: "Contributions per day of the week as rising bars, with your busiest day lit up.",
  scope: "profile",
  category: "Activity",
  kind: "svg",
  width: "half",
  needs: ["calendar"],
  defaults: { label: "weekday rhythm", metric: "total", start: "mon", colour: "highlight" },
  fields: [
    { key: "label", label: "Label", type: "text" },
    {
      key: "metric",
      label: "Show",
      type: "segmented",
      options: [
        { value: "total", label: "Total" },
        { value: "average", label: "Average per day" },
      ],
    },
    {
      key: "start",
      label: "Week starts on",
      type: "segmented",
      options: [
        { value: "mon", label: "Monday" },
        { value: "sun", label: "Sunday" },
      ],
    },
    {
      key: "colour",
      label: "Bar colours",
      type: "segmented",
      options: [
        { value: "highlight", label: "Highlight busiest" },
        { value: "heat", label: "Heat scale" },
      ],
    },
  ],
  alt: () => "Contributions per weekday",
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const avg = o.metric === "average";
    const sunFirst = optPick(o.start, ["mon", "sun"], "mon") === "sun";
    // ctx.d.weekdays is Monday-first; occurrences per weekday for averages
    const totals = ctx.d.weekdays.length === 7 ? ctx.d.weekdays : new Array(7).fill(0);
    const occ = new Array(7).fill(0);
    for (const d of ctx.d.days) occ[(d.weekday + 6) % 7]++;
    const order = sunFirst ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    const vals = order.map((i) => (avg ? (occ[i] ? totals[i] / occ[i] : 0) : totals[i]));
    const names = order.map((i) => weekdayName((i + 1) % 7, true));
    const sum = totals.reduce((a, b) => a + b, 0);
    const max = Math.max(...vals);
    const busy = max > 0 ? vals.indexOf(max) : -1;
    const fmt = (v: number) => (avg ? (v >= 100 ? groupDigits(v) : v.toFixed(1)) : groupDigits(v));

    const top = lbl ? 56 : 28;
    const chartH = 108;
    const base = top + chartH;
    const H = base + 64;
    const slot = (W - 48) / 7;
    const bw = Math.min(30, slot - 16);
    const heatOf = (v: number) => (v <= 0 ? t.heat[0] : t.heat[Math.max(1, Math.min(4, Math.ceil((v / (max || 1)) * 4)))]);
    const bars = vals
      .map((v, i) => {
        const x = 24 + i * slot + (slot - bw) / 2;
        const h = max > 0 ? Math.max(v > 0 ? 4 : 0, (v / max) * (chartH - 18)) : 0;
        const isBusy = i === busy;
        const fill = o.colour === "heat" ? (isBusy ? "url(#busyG)" : heatOf(v)) : isBusy ? "url(#busyG)" : t.subtle;
        const d0 = 0.3 + i * 0.07;
        const label = fmt(v);
        const lw = textWidth(t, label, 11, { bold: isBusy });
        const ls = lw > slot - 2 ? 9.5 : 11;
        return `<rect x="${x.toFixed(1)}" y="${top}" width="${bw}" height="${chartH}" rx="${Math.min(8, bw / 2)}" fill="${t.heat[0]}" opacity=".6" class="fade" style="${dl(0.15)}"/>
${h > 0 ? `${isBusy ? `<rect x="${(x - 4).toFixed(1)}" y="${(base - h - 4).toFixed(1)}" width="${bw + 8}" height="${(h + 4).toFixed(1)}" rx="${Math.min(10, bw / 2 + 4)}" fill="${t.accent}" opacity=".18" filter="url(#softglow)" class="fade"/>` : ""}<rect x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="${Math.min(8, bw / 2, h / 2).toFixed(1)}" fill="${fill}" class="bar" style="${dl(d0)}"/>` : ""}
<text x="${(x + bw / 2).toFixed(1)}" y="${(base - h - 7).toFixed(1)}" font-size="${ls}" text-anchor="middle" class="${isBusy ? "t b" : "m"} fade" style="${dl(d0 + 0.5)}">${esc(label)}</text>
<text x="${(x + bw / 2).toFixed(1)}" y="${base + 20}" font-size="11" text-anchor="middle" class="${isBusy ? "a b" : "m"}">${esc(names[i])}</text>`;
      })
      .join("\n");
    const share = sum > 0 && busy >= 0 ? Math.round((totals[order[busy]] / sum) * 100) : 0;
    const foot =
      busy >= 0
        ? `<text x="24" y="${H - 18}" font-size="11.5" class="m fade" style="${dl(1)}">busiest <tspan class="t b">${esc(weekdayName((order[busy] + 1) % 7))}</tspan> · ${share}% of ${avg ? "activity" : "contributions"}</text>`
        : `<text x="24" y="${H - 18}" font-size="11.5" class="m">No contributions in the last 12 months yet</text>`;
    const weekend = sum > 0 ? Math.round(((totals[5] + totals[6]) / sum) * 100) : 0;
    const right = sum > 0 ? `<text x="${W - 24}" y="${H - 18}" font-size="11.5" text-anchor="end" class="m fade" style="${dl(1.1)}">weekends ${weekend}%</text>` : "";
    const css = `.bar{transform-box:fill-box;transform-origin:bottom;animation:grow .9s cubic-bezier(.2,.7,.2,1) both}`;
    const defs = `<linearGradient id="busyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${accentDeep(t)}"/></linearGradient>`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, fitText(t, avg ? "avg per day" : "last 12 months", 11.5, 140)) : ""}
<path d="M24 ${base + 0.5}H${W - 24}" stroke="${t.border}"/>
${bars}
${foot}
${right}`;
    return svg({ width: W, height: H, theme: t, title: "Contributions per weekday", css, defs, body });
  },
});
