import type { ProfileData } from "../data/types";
import { esc, groupDigits } from "../lib/escape";
import { card, fitText, svg, textWidth, wrapText } from "../lib/svg";
import { glyph } from "./parts";
import { repoName } from "./nowbuilding";
import { defineWidget } from "./types";

const W = 415;
const H = 168;

interface ProjectInfo {
  name: string;
  description: string;
  url: string;
  stars: number;
  /** null when unknown (not every data source reports forks) */
  forks: number | null;
  language: { name: string; color: string } | null;
}

type Source = "pinned" | "starred" | "named";

function sourceOf(o: Record<string, unknown>): Source {
  return o.source === "starred" || o.source === "named" ? o.source : "pinned";
}

function indexOf(o: Record<string, unknown>): number {
  return Math.max(1, Math.min(6, Math.round(Number(o.index) || 1)));
}

/** Resolve the repository a project card shows. */
export function pickProject(data: ProfileData, o: Record<string, unknown>): ProjectInfo | null {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const repos = Array.isArray(data.repos) ? data.repos : [];
  const forksOf = (name: string) => projects.find((p) => p.name.toLowerCase() === name.toLowerCase())?.forks ?? null;
  const src = sourceOf(o);
  if (src === "pinned") {
    const p = projects[indexOf(o) - 1];
    return p ? { ...p } : null;
  }
  if (src === "starred") {
    const r = [...repos].sort((a, b) => b.stars - a.stars || (b.pushedAt || "").localeCompare(a.pushedAt || ""))[indexOf(o) - 1];
    return r ? { name: r.name, description: r.description, url: r.url, stars: r.stars, forks: forksOf(r.name), language: r.language } : null;
  }
  const key = repoName(o.repo).toLowerCase();
  if (!key) return null;
  const p = projects.find((x) => x.name.toLowerCase() === key);
  if (p) return { ...p };
  const r = repos.find((x) => x.name.toLowerCase() === key);
  return r ? { name: r.name, description: r.description, url: r.url, stars: r.stars, forks: null, language: r.language } : null;
}

export const project = defineWidget({
  type: "project",
  title: "Project card",
  description: "One repository as a polished card with its description, language and stars, framed by a running accent light.",
  category: "Projects",
  kind: "svg",
  width: "half",
  needs: ["repos"],
  defaults: { source: "pinned", index: 1, repo: "", stats: true, accent: "runner", number: true },
  fields: [
    {
      key: "source",
      label: "Repository",
      type: "segmented",
      options: [
        { value: "pinned", label: "Pinned" },
        { value: "starred", label: "Top starred" },
        { value: "named", label: "By name" },
      ],
    },
    { key: "index", label: "Position", type: "number", min: 1, max: 6, help: "Which pinned repository, or rank by stars.", when: { key: "source", is: ["pinned", "starred"] } },
    { key: "repo", label: "Repository name", type: "text", placeholder: "my-project", when: { key: "source", is: ["named"] } },
    { key: "stats", label: "Language and stars", type: "toggle" },
    {
      key: "accent",
      label: "Accent",
      type: "segmented",
      options: [
        { value: "runner", label: "Running light" },
        { value: "bar", label: "Top bar" },
        { value: "none", label: "None" },
      ],
    },
    { key: "number", label: "Big number", type: "toggle", help: "Watermark with the slot number.", when: { key: "source", is: ["pinned", "starred"] } },
  ],
  alt: (ctx, o) => {
    const src = sourceOf(o);
    if (src === "named") return repoName(o.repo) ? `project ${repoName(o.repo)}` : "project";
    return src === "pinned" ? `pinned project ${indexOf(o)}` : `top starred project #${indexOf(o)}`;
  },
  href: (ctx, o) => pickProject(ctx.data, o)?.url || `https://github.com/${ctx.profile.login}`,
  render(ctx, o) {
    const t = ctx.theme;
    const src = sourceOf(o);
    const index = indexOf(o);
    const p = pickProject(ctx.data, o);
    const stagger = (index - 1) * 0.1;
    const rr = Math.min(t.radius, H / 2 - 1);
    const pw = W - 1;
    const ph = H - 1;
    const perim = 2 * (pw + ph) - (8 - 2 * Math.PI) * rr;
    const css = `.run{stroke-dasharray:90 ${(perim - 90).toFixed(1)};animation:runB 6s linear ${(-(index - 1) * 1.5).toFixed(1)}s infinite}
@keyframes runB{to{stroke-dashoffset:-${perim.toFixed(1)}}}
.tw{transform-box:fill-box;transform-origin:center;animation:tw 2.6s ease-in-out ${((index - 1) * 0.4).toFixed(1)}s infinite}
@keyframes tw{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.25) rotate(20deg)}}`;

    if (!p) {
      const hint =
        src === "pinned"
          ? `Pinned slot ${index} is empty. Pin a repository on your profile to fill it.`
          : src === "starred"
            ? `There is no repository at star rank ${index} yet.`
            : repoName(o.repo)
              ? `“${repoName(o.repo)}” was not found among your public repositories.`
              : "Choose a repository by name in the inspector.";
      const lines = wrapText(t, hint, 11, W - 80, 2);
      const body = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${rr}" fill="${t.surface ? t.card : "none"}" stroke="${t.border}" stroke-width="${Math.max(1, t.borderWidth)}" stroke-dasharray="4 6"/>
<g class="in">
${glyph("repo", W / 2 - 9, H / 2 - 44, 18, t.muted)}
<text x="${W / 2}" y="${H / 2 - 2}" font-size="13" text-anchor="middle" class="m b">next project loading…</text>
${lines.map((l, i) => `<text x="${W / 2}" y="${H / 2 + 20 + i * 15}" font-size="11" text-anchor="middle" class="m" opacity=".8">${esc(l)}</text>`).join("")}
</g>`;
      return svg({ width: W, height: H, theme: t, title: "upcoming project", css, body });
    }

    const showNo = Boolean(o.number) && src !== "named";
    const no = String(index).padStart(2, "0");
    const noW = showNo ? textWidth(t, no, 40, { bold: true, heading: true }) : 0;
    const nameMax = W - 46 - 22 - (showNo ? noW + 10 : 0);
    const name = fitText(t, p.name, 16, nameMax, { bold: true, heading: true });
    const stats = Boolean(o.stats);
    const lines = wrapText(t, p.description || "No description yet.", 12, W - 44, stats ? 3 : 4);
    const accent = o.accent === "bar" || o.accent === "none" ? o.accent : "runner";
    const defs = `<clipPath id="pcard"><rect x=".5" y=".5" width="${pw}" height="${ph}" rx="${rr}"/></clipPath>`;
    const accentMarkup =
      accent === "runner"
        ? `<rect class="run loop loop-only" x=".5" y=".5" width="${pw}" height="${ph}" rx="${rr}" stroke="url(#accentGrad)" stroke-width="1.5" stroke-linecap="round"/>`
        : accent === "bar"
          ? `<g clip-path="url(#pcard)"><rect x="0" y="0" width="${W}" height="3" fill="url(#accentGrad)" style="transform-box:fill-box;transform-origin:left;animation:growX 1s cubic-bezier(.2,.7,.2,1) ${(0.2 + stagger).toFixed(2)}s both"/></g>`
          : "";

    let statRow = "";
    if (stats) {
      const y = H - 15.5;
      const parts: string[] = [];
      let x = W - 22;
      if (p.forks !== null) {
        const f = groupDigits(p.forks);
        x -= textWidth(t, f, 12);
        parts.push(`<text x="${x.toFixed(1)}" y="${y}" font-size="12" class="t">${f}</text>`);
        x -= 20;
        parts.push(glyph("fork", +x.toFixed(1), H - 28, 14, t.muted));
        x -= 18;
      }
      const s = groupDigits(p.stars);
      x -= textWidth(t, s, 12);
      parts.push(`<text x="${x.toFixed(1)}" y="${y}" font-size="12" class="t">${s}</text>`);
      x -= 20;
      parts.push(`<g class="tw loop">${glyph("star", +x.toFixed(1), H - 28, 14, t.glow)}</g>`);
      const langMax = x - 18 - 40;
      const lang = p.language
        ? `<circle cx="28" cy="${H - 20}" r="5" fill="${p.language.color || t.accent}"/><text x="40" y="${y}" font-size="12" class="t">${esc(fitText(t, p.language.name, 12, langMax))}</text>`
        : "";
      statRow = `<g class="in" style="animation-delay:${(0.3 + stagger).toFixed(2)}s">
<path d="M22 ${H - 40}H${W - 22}" stroke="${t.border}"/>
${lang}${parts.join("")}
</g>`;
    }

    const body = `${card(t, { width: W, height: H, radius: rr })}
${accentMarkup}
${showNo ? `<text x="${W - 22}" y="48" font-size="40" text-anchor="end" class="b h" fill="${t.subtle}" opacity=".5">${no}</text>` : ""}
<g class="in" style="animation-delay:${(0.1 + stagger).toFixed(2)}s">
${glyph("repo", 22, 22, 16, t.accent)}
<text x="46" y="35" font-size="16" class="t b h">${esc(name)}</text>
${lines.map((l, i) => `<text x="22" y="${66 + i * 18}" font-size="12" class="m">${esc(l)}</text>`).join("")}
</g>
${statRow}`;
    return svg({ width: W, height: H, theme: t, title: p.name, css, defs, body });
  },
});
