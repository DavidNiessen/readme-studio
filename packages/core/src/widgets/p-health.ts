import { ago, esc, groupDigits } from "../lib/escape";
import { card, f, fitText, svg, textWidth } from "../lib/svg";
import { dl, header, optBool, optStr } from "./kit-d";
import { ciColor, ciStatus, latestRelease, latestTag, mono, noRepo, pdata, repoUrl, xglyph, type XGlyph } from "./kit-e";
import { glyph, type GlyphName } from "./parts";
import { defineWidget } from "./types";

const W = 415;

const STATUS_TEXT = { passing: "Build passing", failing: "Build failing", running: "Build running", unknown: "No CI runs yet" } as const;

export const repoHealth = defineWidget({
  type: "repo-health",
  title: "Repository vitals",
  description: "A compact health check: build status with a live pulse, last commit, latest release, issue and pull request balance, and the licence.",
  scope: "project",
  category: "Stats",
  kind: "svg",
  width: "half",
  needs: ["project", "releases"],
  defaults: { label: "repo vitals", license: true },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "license", label: "Licence row", type: "toggle" },
  ],
  alt: (ctx) => {
    const pd = pdata(ctx);
    if (!pd) return "repository vitals";
    return `${pd.fullName}: build ${ciStatus(pd)}, ${groupDigits(pd.openIssues)} open issues`;
  },
  href: (ctx) => pdata(ctx)?.ci?.url || `${repoUrl(ctx)}/actions`,
  render(ctx, o) {
    const t = ctx.theme;
    const pd = pdata(ctx);
    const lbl = optStr(o.label);
    const top = lbl ? 48 : 22;
    if (!pd) {
      const H = top + 150;
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl) : ""}${noRepo(t, 24, top, W - 48, 126, "Vitals")}`;
      return svg({ width: W, height: H, theme: t, title: "repository vitals", body });
    }
    const status = ciStatus(pd);
    const sc = ciColor(t, status);
    const dark = t.name === "dark";

    // ---------------------------------------------- CI panel
    const ciH = 54;
    const icx = 24 + 26;
    const icy = top + ciH / 2;
    let indicator: string;
    if (status === "passing") {
      indicator = `<circle cx="${icx}" cy="${icy}" r="13" fill="${sc}" opacity=".16"/>
<circle cx="${icx}" cy="${icy}" r="13" stroke="${sc}" stroke-width="1.5" class="fx loop loop-only" style="animation:ping 2.2s ease-out 1.2s infinite"/>
<circle cx="${icx}" cy="${icy}" r="8" fill="${sc}"/>
<path d="m${icx - 3.6} ${icy + 0.2} 2.4 2.4 4.8-4.8" stroke="${dark ? "#0b0b0c" : "#fff"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else if (status === "failing") {
      indicator = `<circle cx="${icx}" cy="${icy}" r="13" fill="${sc}" opacity=".16"/><circle cx="${icx}" cy="${icy}" r="8" fill="${sc}"/>
<path d="m${icx - 3} ${icy - 3} 6 6m0-6-6 6" stroke="${dark ? "#0b0b0c" : "#fff"}" stroke-width="1.8" stroke-linecap="round"/>`;
    } else if (status === "running") {
      indicator = `<circle cx="${icx}" cy="${icy}" r="9" stroke="${sc}" stroke-opacity=".25" stroke-width="2.5"/>
<path d="M${icx} ${icy - 9}a9 9 0 0 1 9 9" stroke="${sc}" stroke-width="2.5" stroke-linecap="round" class="spinr loop"/>
<circle cx="${icx}" cy="${icy}" r="2.5" fill="${sc}"/>`;
    } else {
      indicator = `<circle cx="${icx}" cy="${icy}" r="9" stroke="${t.subtle}" stroke-width="2" stroke-dasharray="3 3"/>`;
    }
    const wf = pd.ci ? `${pd.ci.name || "workflow"} · ${pd.defaultBranch || "main"}` : "add a workflow to see build status";
    const sha = pd.ci && pd.lastCommit?.sha ? pd.lastCommit.sha.slice(0, 7) : "";
    const mo = mono(t);
    const shaW = sha ? mo.measure(sha, 11) + 14 : 0;
    const ciPanel = `<g class="in" style="${dl(0.15)}">
<rect x="24" y="${top}" width="${W - 48}" height="${ciH}" rx="${Math.max(4, t.radius - 2)}" fill="${t.raised}" stroke="${t.border}"/>
<rect x="24" y="${top + 10}" width="3" height="${ciH - 20}" rx="1.5" fill="${sc}"/>
${indicator}
<text x="${icx + 24}" y="${top + 24}" font-size="14" class="b" fill="${status === "unknown" ? t.text : sc}">${esc(STATUS_TEXT[status])}</text>
<text x="${icx + 24}" y="${top + 41}" font-size="11" class="m">${esc(fitText(t, wf, 11, W - 24 - 14 - (icx + 24) - (shaW ? shaW + 8 : 0)))}</text>
${sha ? `<rect x="${f(W - 38 - shaW)}" y="${icy - 10}" width="${f(shaW)}" height="20" rx="6" fill="${t.card}" stroke="${t.border}"/><text x="${f(W - 38 - shaW / 2)}" y="${icy + 4}" font-size="11" text-anchor="middle" class="m mono">${esc(sha)}</text>` : ""}
</g>`;

    // ---------------------------------------------- rows
    interface Row {
      g: GlyphName | `x:${XGlyph}`;
      label: string;
      value: string;
      sub?: string;
      bar?: number;
      muted?: boolean;
    }
    const rows: Row[] = [];
    rows.push(pd.lastCommit?.date ? { g: "commit", label: "last commit", value: ago(pd.lastCommit.date, ctx.date), sub: pd.lastCommit.author ? `by ${pd.lastCommit.author}` : "" } : { g: "commit", label: "last commit", value: "none yet", muted: true });
    const rel = latestRelease(pd);
    const tag = latestTag(pd);
    rows.push(
      rel
        ? { g: "tag", label: "latest release", value: tag, sub: rel.publishedAt ? ago(rel.publishedAt, ctx.date) : "" }
        : tag
          ? { g: "tag", label: "latest version", value: tag }
          : { g: "tag", label: "latest release", value: "unreleased", muted: true },
    );
    const iAll = pd.openIssues + pd.closedIssues;
    rows.push({ g: "issue", label: "issues", value: `${groupDigits(pd.openIssues)} open`, sub: `${groupDigits(pd.closedIssues)} closed`, bar: iAll ? pd.closedIssues / iAll : -1 });
    const pAll = pd.mergedPulls + pd.openPulls;
    rows.push({ g: "x:merge", label: "pull requests", value: `${groupDigits(pd.mergedPulls)} merged`, sub: `${groupDigits(pd.openPulls)} open`, bar: pAll ? pd.mergedPulls / pAll : -1 });
    if (optBool(o.license, true)) rows.push(pd.license ? { g: "x:scale", label: "licence", value: pd.license } : { g: "x:scale", label: "licence", value: "none", muted: true });

    const rowH = 34;
    const y0 = top + ciH + 14;
    const rowMarkup = rows
      .map((r, i) => {
        const y = y0 + i * rowH;
        const cy = y + rowH / 2;
        const d0 = 0.35 + i * 0.09;
        const g = r.g.startsWith("x:") ? xglyph(r.g.slice(2) as XGlyph, 28, cy - 7.5, 15, t.accent) : glyph(r.g as GlyphName, 28, cy - 7.5, 15, t.accent);
        const subW = r.sub ? textWidth(t, r.sub, 11) : 0;
        const valW = textWidth(t, r.value, 12.5, { bold: true });
        const rightX = W - 28;
        const valX = r.sub ? rightX - subW - 10 : rightX;
        const sep = i < rows.length - 1 ? `<path d="M24 ${y + rowH}H${W - 24}" stroke="${t.border}" stroke-dasharray="1 3"/>` : "";
        let bar = "";
        if (r.bar !== undefined && r.bar >= 0) {
          const bx1 = valX - valW - 14;
          const bx0 = Math.max(150, bx1 - 70);
          const bw = bx1 - bx0;
          if (bw > 30) {
            bar = `<rect x="${f(bx0)}" y="${cy - 2.5}" width="${f(bw)}" height="5" rx="2.5" fill="${t.heat[0]}"/><rect x="${f(bx0)}" y="${cy - 2.5}" width="${f(Math.max(2.5, bw * r.bar))}" height="5" rx="2.5" fill="${i === 2 ? t.accent : t.accent2}" style="transform-box:fill-box;transform-origin:left;animation:growX 1s cubic-bezier(.2,.7,.2,1) ${(d0 + 0.3).toFixed(2)}s both"/>`;
          }
        }
        return `<g class="in" style="${dl(d0)}">
${g}
<text x="52" y="${cy + 4}" font-size="12" class="m">${esc(r.label)}</text>
${bar}
<text x="${f(valX)}" y="${cy + 4.5}" font-size="12.5" text-anchor="end" class="${r.muted ? "m" : "t"} b">${esc(r.value)}</text>
${r.sub ? `<text x="${rightX}" y="${cy + 4}" font-size="11" text-anchor="end" class="m">${esc(r.sub)}</text>` : ""}
${sep}
</g>`;
      })
      .join("\n");
    const H = y0 + rows.length * rowH + 14;
    const css = `${mo.css}
@keyframes ping{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.8);opacity:0}}
.spinr{transform-origin:${icx}px ${icy}px;animation:spin 1.1s linear infinite}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl) : ""}
${ciPanel}
${rowMarkup}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body });
  },
});
