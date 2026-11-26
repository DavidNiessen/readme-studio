import type { ProfileData, RepoSummary } from "../data/types";
import { ago, esc } from "../lib/escape";
import { card, EASE, fitSize, fitText, label, svg, textWidth } from "../lib/svg";
import type { Theme } from "../theme";
import { glyph, onAccent } from "./parts";
import { fitLabel } from "./rhythm";
import { defineWidget } from "./types";

const W = 840;
const H = 230;
/** left edge of the text column */
const TX = 300;
const TR = W - 24;

/** Normalise "owner/name", a GitHub URL or a bare name to the repository name. */
export function repoName(input: unknown): string {
  return String(input ?? "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .split("/")
    .pop()!
    .trim();
}

export interface PickedRepo {
  repo: RepoSummary;
  /** a named repository that is not in the fetched data */
  missing: boolean;
}

/** The named repository, or the most recently pushed one that is not the profile repository. */
export function pickNowRepo(data: ProfileData, login: string, wanted: unknown): PickedRepo | null {
  const name = repoName(wanted);
  const repos = Array.isArray(data.repos) ? data.repos : [];
  if (name) {
    const key = name.toLowerCase();
    const r = repos.find((x) => x.name.toLowerCase() === key);
    if (r) return { repo: r, missing: false };
    const p = (data.projects ?? []).find((x) => x.name.toLowerCase() === key);
    if (p) return { repo: { name: p.name, description: p.description, url: p.url, stars: p.stars, language: p.language, createdAt: "", pushedAt: "" }, missing: false };
    return {
      repo: { name, description: "", url: `https://github.com/${login}/${name}`, stars: 0, language: null, createdAt: "", pushedAt: "" },
      missing: true,
    };
  }
  const own = login.toLowerCase();
  const latest = repos
    .filter((r) => r.name.toLowerCase() !== own && !r.name.startsWith("."))
    .sort((a, b) => (b.pushedAt || "").localeCompare(a.pushedAt || ""))[0];
  return latest ? { repo: latest, missing: false } : null;
}

/** Wrap into at most two lines with different widths; the second is ellipsised when cut. */
function twoLines(t: Theme, text: string, size: number, first: number, second: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  let i = 0;
  let line = "";
  while (i < words.length) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (line && textWidth(t, next, size) > first) break;
    line = next;
    i++;
  }
  const out = [fitText(t, line, size, first)];
  if (i < words.length) out.push(fitText(t, words.slice(i).join(" "), size, second));
  return out;
}

/** Short pseudo commit hash, stable for a given repo + push. */
function pseudoSha(seed: string): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

export const nowBuilding = defineWidget({
  type: "now",
  title: "Now building",
  description: "Spotlights the project you are pushing to right now, with an animated git graph and the last 30 days of activity.",
  category: "Projects",
  kind: "svg",
  width: "full",
  needs: ["repos", "calendar"],
  defaults: { repo: "", label: "now building", sparkline: true, progress: true },
  fields: [
    { key: "repo", label: "Repository", type: "text", placeholder: "Latest pushed repository", help: "Leave empty to always show the repository you pushed to most recently." },
    { key: "label", label: "Headline label", type: "text", placeholder: "now building" },
    { key: "sparkline", label: "Activity sparkline", type: "toggle", help: "Your contributions over the last 30 days." },
    { key: "progress", label: "Lifetime bar", type: "toggle", help: "How long the repository has existed, from first commit to now." },
  ],
  alt: (ctx, o) => {
    const n = repoName(o.repo);
    return n ? `now building: ${n}` : "now building: my most recently pushed repository";
  },
  href: (ctx, o) => pickNowRepo(ctx.data, ctx.profile.login, o.repo)?.repo.url ?? `https://github.com/${ctx.profile.login}`,
  render(ctx, o) {
    const t = ctx.theme;
    const picked = pickNowRepo(ctx.data, ctx.profile.login, o.repo);
    const repo = picked?.repo ?? null;
    const lang = repo?.language?.color || t.glow;
    const full = t.motion === "full";

    // ---------------------------------------------------------------- git graph
    const mainY = 140;
    const featY = 84;
    const branch = `M78 ${mainY}C100 ${mainY} 100 ${featY} 122 ${featY}H178C200 ${featY} 200 ${mainY} 222 ${mainY}`;
    const mainNodes = [40, 78, 222, 252];
    const featNodes = [134, 166];
    const node = (x: number, y: number, i: number, color: string) =>
      `<circle cx="${x}" cy="${y}" r="7" fill="${t.card}" stroke="${color}" stroke-width="2.5" class="fx" style="animation:pop .45s cubic-bezier(.3,1.4,.5,1) ${(0.3 + i * 0.18).toFixed(2)}s both"/>`;
    const head = mainNodes[3];
    const headW = textWidth(t, "HEAD", 11, { bold: true }) + 22;
    const headX = Math.min(head + 8 - headW, head - 14);
    const sha = repo && !picked?.missing ? pseudoSha(`${repo.name}${repo.pushedAt}`) : "";
    // SMIL is not affected by the motion CSS, so the travelling spark is only added with full motion
    const spark = full
      ? `<circle r="3.5" fill="${t.glow}" filter="url(#glow)" opacity="0"><animateMotion dur="3.2s" begin="1.8s" repeatCount="indefinite" path="${branch}"/><set attributeName="opacity" to="1" begin="1.8s"/></circle>`
      : "";
    const graph = `<path d="M24 ${mainY}H262" stroke="${t.subtle}" stroke-width="3" stroke-linecap="round"/>
<path d="M24 ${mainY}H262" stroke="${t.accent}" stroke-width="3" stroke-dasharray="3 9" class="loop" style="animation:flow 1.2s linear infinite"/>
<path d="${branch}" stroke="${lang}" stroke-width="3" stroke-linecap="round" stroke-dasharray="220" stroke-dashoffset="220" style="animation:draw 1.2s ${EASE} .5s forwards"/>
${spark}
${mainNodes.slice(0, 3).map((x, i) => node(x, mainY, i, t.accent)).join("")}
${featNodes.map((x, i) => node(x, featY, i + 1, lang)).join("")}
<circle cx="${head}" cy="${mainY}" r="7" fill="${t.accent}" class="fx" style="animation:pop .45s cubic-bezier(.3,1.4,.5,1) 1.2s both"/>
<circle cx="${head}" cy="${mainY}" r="7" stroke="${t.glow}" stroke-width="2" class="fx loop loop-only" style="animation:ping 1.8s ease-out 1.6s infinite"/>
<g class="in" style="animation-delay:1.4s">
  <rect x="${headX.toFixed(1)}" y="${mainY + 20}" width="${headW.toFixed(1)}" height="20" rx="10" fill="${t.accent}"/>
  <text x="${(headX + headW / 2).toFixed(1)}" y="${mainY + 34}" font-size="11" text-anchor="middle" class="b" fill="${onAccent(t)}">HEAD</text>
  <text x="40" y="${mainY + 34}" font-size="11" class="m">main</text>
  <text x="134" y="${featY - 18}" font-size="11" text-anchor="middle" class="m">feat/*</text>
  ${sha ? `<text x="${head - 52}" y="${mainY - 16}" font-size="11" text-anchor="end" class="t b">${sha}</text>` : ""}
</g>`;

    // ---------------------------------------------------------------- header + text column
    const pushed = repo?.pushedAt ? `last push ${ago(repo.pushedAt, ctx.date)}` : "";
    const pushW = pushed ? textWidth(t, pushed, 12) : 0;
    const head1 = o.label
      ? label(t, TX, 40, fitLabel(t, String(o.label), TR - TX - (pushW ? pushW + 16 : 0)))
      : "";
    const name = repo?.name ?? "nothing public yet";
    const nameMax = TR - TX;
    const nameSize = fitSize(t, name, 30, nameMax, 18, { bold: true, heading: true });
    const nameText = fitText(t, name, nameSize, nameMax, { bold: true, heading: true });
    const desc = !repo
      ? "Push to a public repository and it will show up here."
      : picked?.missing
        ? "This repository was not found among your public repositories."
        : repo.description || "No description yet. The code speaks for itself.";
    const showSpark = Boolean(o.sparkline);
    const sx = 560;
    // the second line stops short of the sparkline caption
    const lines = twoLines(t, desc, 13, TR - TX, showSpark ? sx - 24 - TX : TR - TX);
    const metaMax = (showSpark ? sx - 24 : TR) - TX;
    let meta = "";
    if (repo && !picked?.missing) {
      const parts: string[] = [];
      let x = TX;
      if (repo.language) {
        const ln = fitText(t, repo.language.name, 12, metaMax - 80);
        parts.push(`<circle cx="${x + 5}" cy="170" r="5" fill="${repo.language.color || t.accent}"/><text x="${x + 16}" y="174.5" font-size="12" class="t">${esc(ln)}</text>`);
        x += 16 + textWidth(t, ln, 12) + 18;
      }
      parts.push(`${glyph("star", x, 163, 12, t.glow)}<text x="${x + 17}" y="174.5" font-size="12" class="m">${esc(repo.stars)}</text>`);
      meta = `<g class="in" style="animation-delay:.7s">${parts.join("")}</g>`;
    }

    // ---------------------------------------------------------------- 30-day sparkline
    let sparkline = "";
    if (showSpark) {
      const recent = ctx.d.days.slice(-30);
      const counts = recent.length ? recent.map((d) => d.count) : new Array(30).fill(0);
      const rMax = Math.max(1, ...counts);
      const step = (TR - 5.4 - sx) / Math.max(1, counts.length - 1);
      sparkline =
        counts
          .map((c, i) => {
            const bh = Math.max(2, (c / rMax) * 40);
            return `<rect x="${(sx + i * step).toFixed(1)}" y="${(190 - bh).toFixed(1)}" width="5.4" height="${bh.toFixed(1)}" rx="2" fill="${c === rMax ? t.glow : c > 0 ? t.accent : t.subtle}" opacity="${c > 0 ? 1 : 0.6}" style="transform-box:fill-box;transform-origin:bottom;animation:grow .6s ${EASE} ${(0.6 + i * 0.03).toFixed(2)}s both"/>`;
          })
          .join("") + `<text x="${TR}" y="144" font-size="10" text-anchor="end" class="m fade" style="animation-delay:.6s">last 30 days</text>`;
    }

    // ---------------------------------------------------------------- lifetime bar
    let progress = "";
    if (o.progress) {
      const created = repo?.createdAt ? new Date(repo.createdAt) : null;
      const pushedAt = repo?.pushedAt ? new Date(repo.pushedAt) : null;
      const valid = created && !Number.isNaN(created.getTime());
      const span = valid ? Math.max(1, ctx.date.getTime() - created.getTime()) : 1;
      const prog = valid && pushedAt ? Math.min(1, Math.max(0.04, (pushedAt.getTime() - created.getTime()) / span)) : valid ? 1 : 0;
      progress = `<rect x="${TX}" y="196" width="${TR - TX}" height="3" rx="1.5" fill="${t.raised}"/>
${prog ? `<rect class="prog" x="${TX}" y="196" width="${((TR - TX) * prog).toFixed(1)}" height="3" rx="1.5" fill="url(#accentGrad)"/>` : ""}
<text x="${TX}" y="216" font-size="10" class="m">${esc(valid ? `created ${ago(repo!.createdAt, ctx.date)}` : "")}</text>
<text x="${TR}" y="216" font-size="10" text-anchor="end" class="m">now</text>`;
    }

    const css = `
@keyframes flow{to{stroke-dashoffset:-12}}
@keyframes ping{0%{transform:scale(1);opacity:1}100%{transform:scale(2.6);opacity:0}}
.prog{transform-box:fill-box;transform-origin:left;animation:growX 2.4s ${EASE} .6s both}`;
    const body = `${card(t, { width: W, height: H })}
${graph}
${head1}
${pushed ? `<text x="${TR}" y="40" font-size="12" text-anchor="end" class="m fade" style="animation-delay:.2s">${esc(pushed)}</text>` : ""}
<g class="in" style="animation-delay:.3s"><text x="${TX}" y="86" font-size="${nameSize}" class="${repo ? "t" : "m"} b h">${esc(nameText)}</text></g>
${lines.map((l, i) => `<g class="in" style="animation-delay:${(0.45 + i * 0.1).toFixed(2)}s"><text x="${TX}" y="${114 + i * 19}" font-size="13" class="m">${esc(l)}</text></g>`).join("")}
${meta}
${sparkline}
${progress}`;
    return svg({ width: W, height: H, theme: t, title: repo ? `now building: ${repo.name}` : "now building", css, body });
  },
});
