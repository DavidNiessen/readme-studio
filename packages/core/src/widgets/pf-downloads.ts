import type { PackageDownloads } from "../data/types";
import { esc, groupDigits } from "../lib/escape";
import { odometer, odometerWidth } from "../lib/odometer";
import { card, fitText, svg, textWidth } from "../lib/svg";
import { mark, n1 } from "./kit-c";
import { TNUM, dl, emptyState, header, optPick, optStr } from "./kit-d";
import { okColor, projectData, repoUrl } from "./kit-f";
import { defineWidget, type Ctx } from "./types";

const W = 415;
const H = 226;

const REG: Record<PackageDownloads["registry"], { name: string; icon: string; url: (n: string) => string }> = {
  npm: { name: "npm", icon: "npm", url: (n) => `https://www.npmjs.com/package/${n}` },
  pypi: { name: "PyPI", icon: "python", url: (n) => `https://pypi.org/project/${n}/` },
  crates: { name: "crates.io", icon: "rust", url: (n) => `https://crates.io/crates/${n}` },
};

function pickPkg(ctx: Pick<Ctx, "data">, o: Record<string, unknown>): PackageDownloads | undefined {
  const list = (projectData(ctx)?.downloads ?? []).filter((d) => d && REG[d.registry] && d.name);
  const want = optPick(o.registry, ["auto", "npm", "pypi", "crates"], "auto");
  if (want !== "auto") return list.find((d) => d.registry === want);
  return [...list].sort((a, b) => (b.lastWeek ?? -1) - (a.lastWeek ?? -1))[0];
}

function sum(a: number[]): number {
  return a.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0);
}

export const pfDownloads = defineWidget({
  type: "downloads",
  title: "Package downloads",
  description: "Weekly, monthly or all-time downloads from npm, PyPI or crates.io on a rolling counter, with a year-long sparkline and the month-on-month trend.",
  scope: "project",
  category: "Stats",
  kind: "svg",
  width: "half",
  needs: ["project", "downloads"],
  defaults: { label: "downloads", period: "week", registry: "auto" },
  fields: [
    { key: "label", label: "Label", type: "text", placeholder: "downloads" },
    {
      key: "period",
      label: "Count",
      type: "segmented",
      options: [
        { value: "week", label: "Weekly" },
        { value: "month", label: "Monthly" },
        { value: "total", label: "All time" },
      ],
    },
    {
      key: "registry",
      label: "Registry",
      type: "segmented",
      options: [
        { value: "auto", label: "Automatic" },
        { value: "npm", label: "npm" },
        { value: "pypi", label: "PyPI" },
        { value: "crates", label: "crates.io" },
      ],
      help: "Package names come from the project settings.",
    },
  ],
  alt: (ctx, o) => {
    const p = pickPkg(ctx, o);
    if (!p) return "Package downloads";
    const v = p.lastWeek ?? p.lastMonth ?? p.total;
    return `${p.name} on ${REG[p.registry].name}${v !== null ? `: ${groupDigits(v)} downloads` : ""}`;
  },
  href: (ctx, o) => {
    const p = pickPkg(ctx, o);
    return p ? REG[p.registry].url(p.name) : repoUrl(ctx);
  },
  render(ctx, o) {
    const t = ctx.theme;
    const lbl = optStr(o.label);
    const p = pickPkg(ctx, o);
    const top = lbl ? 0 : -26;
    const HH = H + top;

    if (!p) {
      const want = optPick(o.registry, ["auto", "npm", "pypi", "crates"], "auto");
      const where = want === "auto" ? "an npm, PyPI or crates.io package" : `a ${REG[want].name} package`;
      const body = `${card(t, { width: W, height: HH })}
${lbl ? header(t, W, lbl) : ""}
${emptyState(t, 24, 50 + top, W - 48, HH - 74 - top, "chart", "No download stats yet", `Set ${where} in the project settings.`)}`;
      return svg({ width: W, height: HH, theme: t, title: "Package downloads", body });
    }

    const reg = REG[p.registry];
    const weekly = (Array.isArray(p.weekly) ? p.weekly : []).filter((v) => Number.isFinite(v)).slice(-52);
    const period = optPick(o.period, ["week", "month", "total"], "week");
    let value: number | null = null;
    let unit = "";
    if (period === "week") {
      value = p.lastWeek ?? (weekly.length ? weekly[weekly.length - 1] : null);
      unit = "/ week";
    } else if (period === "month") {
      value = p.lastMonth ?? (weekly.length >= 4 ? sum(weekly.slice(-4)) : null);
      unit = "/ month";
    } else {
      value = p.total;
      unit = "all time";
      if (value === null && weekly.length) {
        value = sum(weekly);
        unit = "past year";
      }
    }
    const v = Math.max(0, Math.round(value ?? 0));
    const valueTxt = value === null ? "—" : groupDigits(v);

    // registry badge (top right)
    const regW = textWidth(t, reg.name, 11.5, { bold: true }) + 14 + 8 + 18;
    const regBadge = `<g class="fade" style="${dl(0.2)}"><rect x="${n1(W - 24 - regW + 0.5)}" y="${16.5}" width="${n1(regW - 1)}" height="23" rx="11.5" fill="${t.raised}" stroke="${t.border}"/>
${mark(t, reg.icon, W - 24 - regW + 9, 21, 14, "brand", t.raised)}<text x="${n1(W - 24 - regW + 29)}" y="${32.5}" font-size="11.5" class="t b">${esc(reg.name)}</text></g>`;

    // big number
    const numY = 94 + top;
    let size = 42;
    const unitW = textWidth(t, unit, 13);
    while (size > 24 && odometerWidth(t, valueTxt, size, true, true) + unitW + 10 > W - 48 - 110) size -= 2;
    const vw = odometerWidth(t, valueTxt, size, true, true);
    const num =
      value === null
        ? `<text x="24" y="${numY}" font-size="${size}" class="m b h">—</text>`
        : `<g class="tn">${odometer(t, valueTxt, { x: 22, y: numY, fontSize: size, delay: 0.3, duration: 2, heading: true })}</g>`;

    // trend vs the previous four weeks
    let trend = "";
    if (weekly.length >= 8) {
      const a = sum(weekly.slice(-4));
      const b = sum(weekly.slice(-8, -4));
      if (b > 0) {
        const pct = (a / b - 1) * 100;
        const up = pct >= 0;
        const c = up ? okColor(t) : t.name === "dark" ? "#f85149" : "#cf222e";
        const txt = `${up ? "+" : "−"}${Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
        const tw = textWidth(t, txt, 12, { bold: true }) + 30;
        const tx = W - 24 - tw;
        const ty = numY - 22;
        const arrow = up ? `M${n1(tx + 11)} ${ty + 13}l4-4.5 4 4.5M${n1(tx + 15)} ${ty + 8.5}v7` : `M${n1(tx + 11)} ${ty + 9}l4 4.5 4-4.5M${n1(tx + 15)} ${ty + 13.5}v-7`;
        trend = `<g class="in" style="${dl(0.5)}"><rect x="${n1(tx + 0.5)}" y="${ty + 0.5}" width="${n1(tw - 1)}" height="21" rx="10.5" fill="${c}" fill-opacity="${t.name === "dark" ? 0.14 : 0.1}" stroke="${c}" stroke-opacity=".4"/>
<path d="${arrow}" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="${n1(tx + 24)}" y="${ty + 15}" font-size="12" class="b" fill="${c}">${txt}</text>
<text x="${W - 24}" y="${ty + 38}" font-size="11" text-anchor="end" class="m">vs last month</text></g>`;
      }
    }

    // package line
    const ver = p.version ? `v${p.version.replace(/^v/, "")}` : "";
    const pkgName = fitText(t, p.name, 12.5, 200, { bold: true });
    const pkgW = textWidth(t, pkgName, 12.5, { bold: true });
    const pkgLine = `<g class="in" style="${dl(0.35)}"><text x="24" y="${numY + 24}" font-size="12.5" class="t b">${esc(pkgName)}</text>${ver ? `<text x="${n1(24 + pkgW + 8)}" y="${numY + 24}" font-size="12" class="m">${esc(fitText(t, ver, 12, W - 48 - pkgW - 8 - 110))}</text>` : ""}</g>`;

    // 52-week sparkline
    let spark = "";
    const sx0 = 24;
    const sx1 = W - 24;
    const sy0 = numY + 44;
    const sy1 = HH - 32;
    if (weekly.length >= 2) {
      const max = Math.max(...weekly, 1);
      const min = Math.min(...weekly);
      const lo = Math.max(0, min - (max - min) * 0.35);
      const pts = weekly.map((w, i) => [sx0 + ((sx1 - sx0) * i) / (weekly.length - 1), sy1 - ((w - lo) / Math.max(1, max - lo)) * (sy1 - sy0)] as [number, number]);
      // smooth with a Catmull-Rom → Bézier pass
      let d = `M${n1(pts[0][0])} ${n1(pts[0][1])}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += `C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(p2[0])} ${n1(p2[1])}`;
      }
      const last = pts[pts.length - 1];
      const area = `${d}L${n1(sx1)} ${sy1}L${sx0} ${sy1}Z`;
      const peak = weekly.indexOf(max);
      const pk = pts[peak];
      spark = `<path d="M${sx0} ${sy1 + 0.5}H${sx1}" stroke="${t.border}"/>
<path d="${area}" fill="url(#dlA)" class="fade" style="${dl(0.9)}"/>
<path d="${d}" stroke="${t.accent}" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" class="line"/>
${peak !== pts.length - 1 ? `<g class="fade" style="${dl(1.8)}"><circle cx="${n1(pk[0])}" cy="${n1(pk[1])}" r="2.5" fill="${t.card}" stroke="${t.accent}" stroke-width="1.4"/></g>` : ""}
<g class="fade" style="${dl(1.9)}"><circle cx="${n1(last[0])}" cy="${n1(last[1])}" r="7" fill="${t.accent}" opacity=".25" class="fx pulse2 loop loop-only"/><circle cx="${n1(last[0])}" cy="${n1(last[1])}" r="3.5" fill="${t.accent}" stroke="${t.card}" stroke-width="1.5"/></g>
<text x="${sx0}" y="${HH - 14}" font-size="10.5" class="m fade" style="${dl(1)}">${weekly.length} weeks ago</text>
<text x="${sx1}" y="${HH - 14}" font-size="10.5" text-anchor="end" class="m fade" style="${dl(1)}">${esc(`peak ${groupDigits(max)} / wk`)}</text>`;
    } else {
      spark = `<text x="${W / 2}" y="${n1((sy0 + sy1) / 2 + 4)}" font-size="11.5" text-anchor="middle" class="m fade" style="${dl(0.6)}">Weekly history appears after a few weeks of data.</text>`;
    }

    const css = `${TNUM}
.line{animation:draw 2s cubic-bezier(.4,0,.2,1) .6s forwards}
.pulse2{animation:dlPulse 2.4s ease-out 2.4s infinite}
@keyframes dlPulse{0%{transform:scale(.6);opacity:.6}100%{transform:scale(2);opacity:0}}`;
    const defs = `<linearGradient id="dlA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.name === "dark" ? 0.32 : 0.2}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></linearGradient>`;
    const body = `${card(t, { width: W, height: HH })}
${lbl ? header(t, W, lbl) : ""}
${regBadge}
<g class="in" style="${dl(0.15)}">${num}<text x="${n1(24 + vw + 8)}" y="${numY}" font-size="13" class="m">${esc(unit)}</text></g>
${trend}
${pkgLine}
${spark}`;
    return svg({ width: W, height: HH, theme: t, title: this.alt(ctx, o), css, defs, body });
  },
});
