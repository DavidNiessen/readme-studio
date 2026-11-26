import type { ProjectInfo } from "../config";
import type { ProfileData } from "../data/types";
import { fontInfo, measureText } from "../fonts";
import { isHex, mix } from "../lib/color";
import { ago, esc } from "../lib/escape";
import { svg } from "../lib/svg";
import type { Theme } from "../theme";
import { hasMark, items, mark, str } from "./kit-c";
import { compact, optBool, optList, optPick } from "./kit-d";
import { ciColor, ciFill, ciStatus, latestRelease, latestTag, pdata, repoUrl, xglyphs, type CiStatus } from "./kit-e";
import { glyphs, onAccent } from "./parts";
import { fillPlaceholders } from "./placeholders";
import { defineWidget, type Ctx } from "./types";

const H = 28;

type Meta = Pick<Ctx, "profile" | "data" | "project" | "kind">;

interface Badge {
  key: string;
  label: string;
  value: string;
  /** line glyph (parts/kit-e) or brand icon id */
  icon: string;
  href?: string;
  /** value colour override (hex) */
  color?: string;
  status?: CiStatus;
  /** single-segment badge (topics) */
  solo?: boolean;
}

const BADGES = [
  { value: "version", label: "Version" },
  { value: "license", label: "Licence" },
  { value: "ci", label: "Build status" },
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "downloads", label: "Weekly downloads" },
  { value: "contributors", label: "Contributors" },
  { value: "issues", label: "Open issues" },
  { value: "prs", label: "Open pull requests" },
  { value: "commit", label: "Last commit" },
  { value: "release", label: "Last release" },
  { value: "topics", label: "Topics (one badge each)" },
];

const REGISTRY_URL: Record<string, (n: string) => string> = {
  npm: (n) => `https://www.npmjs.com/package/${n}`,
  pypi: (n) => `https://pypi.org/project/${n}/`,
  crates: (n) => `https://crates.io/crates/${n}`,
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "x";
}

function badgeList(ctx: Meta, o: Record<string, unknown>, now = new Date(ctx.data?.generatedAt || Date.now())): Badge[] {
  const pd = pdata(ctx);
  const url = repoUrl(ctx as { data: ProfileData; project: ProjectInfo });
  const branch = pd?.defaultBranch || "main";
  const dash = "–";
  const out: Badge[] = [];
  for (const k of optList(o.badges)) {
    switch (k) {
      case "version": {
        const v = latestTag(pd);
        if (pd && !v) break;
        const rel = latestRelease(pd);
        out.push({ key: k, label: "version", value: v || dash, icon: "tag", href: rel?.url || `${url}/releases` });
        break;
      }
      case "license":
        if (pd && !pd.license) break;
        out.push({ key: k, label: "license", value: pd?.license || dash, icon: "x:scale", href: `${url}/blob/${branch}/LICENSE` });
        break;
      case "ci": {
        if (pd && !pd.ci) break;
        const s = ciStatus(pd);
        out.push({ key: k, label: pd?.ci?.name || "build", value: s, status: s, icon: "x:shield", href: pd?.ci?.url || `${url}/actions` });
        break;
      }
      case "stars":
        out.push({ key: k, label: "stars", value: pd ? compact(pd.stars) : dash, icon: "star", href: `${url}/stargazers` });
        break;
      case "forks":
        out.push({ key: k, label: "forks", value: pd ? compact(pd.forks) : dash, icon: "fork", href: `${url}/forks` });
        break;
      case "downloads": {
        const d = (pd?.downloads ?? []).find((x) => x && typeof x.lastWeek === "number");
        if (pd && !d) break;
        const name = d?.name || ctx.project.packages?.npm || "";
        const reg = d?.registry || "npm";
        out.push({
          key: k,
          label: d ? `${reg} downloads` : "downloads",
          value: d ? `${compact(d.lastWeek!)}/week` : dash,
          icon: "x:download",
          href: name && REGISTRY_URL[reg] ? REGISTRY_URL[reg](name) : url,
        });
        break;
      }
      case "contributors":
        out.push({ key: k, label: "contributors", value: pd ? compact(pd.contributorCount) : dash, icon: "users", href: `${url}/graphs/contributors` });
        break;
      case "issues":
        out.push({ key: k, label: "issues", value: pd ? `${compact(pd.openIssues)} open` : dash, icon: "issue", href: `${url}/issues` });
        break;
      case "prs":
        out.push({ key: k, label: "pull requests", value: pd ? `${compact(pd.openPulls)} open` : dash, icon: "pr", href: `${url}/pulls` });
        break;
      case "commit":
        if (pd && !pd.lastCommit?.date) break;
        out.push({ key: k, label: "last commit", value: pd?.lastCommit?.date ? ago(pd.lastCommit.date, now) : dash, icon: "commit", href: `${url}/commits/${branch}` });
        break;
      case "release": {
        const rel = latestRelease(pd);
        if (pd && !rel?.publishedAt) break;
        out.push({ key: k, label: "release", value: rel?.publishedAt ? ago(rel.publishedAt, now) : dash, icon: "rocket", href: `${url}/releases/latest` });
        break;
      }
      case "topics":
        for (const tp of (pd?.topics ?? []).filter(Boolean).slice(0, 6)) {
          out.push({ key: `topic-${slug(tp)}`, label: "", value: tp, icon: "x:hash", href: `https://github.com/topics/${encodeURIComponent(tp)}`, solo: true });
        }
        break;
    }
  }
  items(o.custom)
    .slice(0, 8)
    .forEach((c, i) => {
      const label = fillPlaceholders(str(c.label), ctx);
      const value = fillPlaceholders(str(c.value), ctx);
      if (!label && !value) return;
      out.push({
        key: `custom-${i + 1}`,
        label: value ? label : "",
        value: value || label,
        icon: str(c.icon),
        color: isHex(c.color) ? (c.color as string) : undefined,
        href: str(c.link) || undefined,
        solo: !value || !label,
      });
    });
  // unique keys
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.key) ? false : (seen.add(b.key), true)));
}

/** System font stack of the theme's font category (badges skip font embedding to stay ~2 KB). */
function badgeFont(t: Theme): { family: string; id: string } {
  const f = fontInfo(t.font);
  // serif faces fall back to the system serif, which reads poorly at badge size: use sans there
  if (f.category === "serif") return { family: fontInfo("inter").fallback, id: "inter" };
  return { family: f.fallback, id: f.id };
}

function drawIcon(t: Theme, id: string, x: number, y: number, size: number, color: string): string {
  if (!id) return "";
  if (id === "x:hash") {
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"><path d="M6 2.5 4.8 13.5M11.2 2.5 10 13.5M2.5 6h11M2 10.5h11"/></svg>`;
  }
  if (id.startsWith("x:")) {
    const name = id.slice(2) as keyof typeof xglyphs;
    if (!xglyphs[name]) return "";
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${xglyphs[name]}</svg>`;
  }
  if (id in glyphs) return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyphs[id as keyof typeof glyphs]}</svg>`;
  return hasMark(id) ? mark(t, id, x, y, size, color) : "";
}

function renderBadge(ctx: Ctx, o: Record<string, unknown>, b: Badge, index: number): string {
  const t = ctx.theme;
  const style = optPick(o.style, ["flat", "rounded", "outline", "plastic"], "rounded");
  const big = style === "plastic"; // "for the badge"
  const icons = optBool(o.icons, true) && !!b.icon;
  const neutral = optPick(o.color, ["accent", "neutral"], "accent") === "neutral";
  const font = badgeFont(t);
  const size = big ? 10.5 : 11.5;
  const ls = big ? 1.2 : 0;
  const weightL = big ? 700 : 400;
  const caps = (s: string) => (big ? s.toUpperCase() : s);
  const label = caps(b.label);
  const value = caps(b.value).slice(0, 48);
  const measure = (s: string, w: 400 | 700) => measureText(s, size, font.id, w, ls);
  const padX = big ? 12 : 10;
  const iconW = icons ? 14 + 6 : 0;
  const lw = b.solo ? 0 : padX + iconW + measure(label, weightL) + padX;
  const vTextW = measure(value, 700);
  const statusDot = b.status && b.status !== "unknown" ? 12 : 0;
  const vw = (b.solo ? padX + iconW : padX) + statusDot + vTextW + padX;
  const W = Math.ceil(lw + vw);
  const r = style === "rounded" ? H / 2 : big ? 3 : 5;
  const dark = t.name === "dark";

  const fill = b.status ? (style === "outline" ? ciColor(t, b.status) : ciFill(t, b.status)) : b.color || (neutral ? t.text : t.accent);
  const outline = style === "outline";
  const labelBg = dark ? t.raised : mix(t.raised, t.text, 0.06);
  const valueBg = b.solo && !b.color ? labelBg : outline ? "none" : neutral && !b.status && !b.color ? mix(labelBg, t.text, dark ? 0.12 : 0.1) : fill;
  const valueInk = outline ? fill : valueBg === labelBg || (neutral && !b.status && !b.color) ? t.text : onAccent(t, fill);
  const labelInk = outline ? t.muted : t.muted;
  const iconInk = b.solo ? (b.color ? onAccent(t, b.color) : t.accent) : outline ? fill : t.accent;
  const baseY = (H / 2 + size * 0.36).toFixed(1);
  const tl = (x: number, s: string, w: number, ink: string, bold: boolean) =>
    `<text x="${x.toFixed(1)}" y="${baseY}" font-size="${size}" fill="${ink}"${bold ? ' font-weight="700"' : ""}${ls ? ` letter-spacing="${ls}"` : ""} textLength="${w.toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(s)}</text>`;

  const parts: string[] = [];
  parts.push(`<clipPath id="bc"><rect width="${W}" height="${H}" rx="${r}"/></clipPath>`);
  parts.push(`<g clip-path="url(#bc)">`);
  if (!outline) {
    parts.push(`<rect width="${W}" height="${H}" fill="${labelBg}"/>`);
    if (!(b.solo && !b.color)) parts.push(`<rect x="${lw.toFixed(1)}" width="${(W - lw).toFixed(1)}" height="${H}" fill="${valueBg}" class="vseg"/>`);
    // soft top highlight for depth
    parts.push(`<rect width="${W}" height="${H / 2}" fill="#fff" opacity="${dark ? 0.04 : 0.12}"/>`);
  } else {
    parts.push(`<rect width="${W}" height="${H}" fill="${t.surface ? t.card : "none"}"/>`);
    if (!b.solo) parts.push(`<rect x="${lw.toFixed(1)}" width="${(W - lw).toFixed(1)}" height="${H}" fill="${fill}" opacity=".12"/>`);
  }
  parts.push(`<rect class="sh loop loop-only" x="-60" width="48" height="${H}" fill="url(#shine)" transform="skewX(-20)" style="animation-delay:${(2 + index * 0.35).toFixed(2)}s"/>`);
  parts.push(`</g>`);
  parts.push(
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${Math.max(0, r - 0.5)}" stroke="${outline ? fill : t.border}" stroke-opacity="${outline ? 0.9 : 1}"/>`,
  );
  if (!b.solo) {
    if (icons) parts.push(drawIcon(t, b.icon, padX, (H - 14) / 2, 14, iconInk));
    parts.push(tl(padX + iconW, label, measure(label, weightL), labelInk, big));
  }
  let vx = lw + (b.solo ? padX + iconW : padX);
  if (b.solo && icons) parts.push(drawIcon(t, b.icon, padX, (H - 14) / 2, 14, iconInk));
  if (statusDot) {
    const cx = vx + 4;
    const ink = outline ? fill : valueInk;
    if (b.status === "running") {
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${H / 2}" r="3.6" stroke="${ink}" stroke-opacity=".35" stroke-width="1.6"/><path d="M${cx.toFixed(1)} ${H / 2 - 3.6}a3.6 3.6 0 0 1 3.6 3.6" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" class="spin loop"/>`);
    } else {
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${H / 2}" r="3.2" fill="${ink}"/>`);
      if (b.status === "passing") parts.push(`<circle cx="${cx.toFixed(1)}" cy="${H / 2}" r="3.2" fill="${ink}" class="ping loop loop-only"/>`);
    }
    vx += statusDot;
  }
  parts.push(`<g class="fade" style="animation-delay:${(0.25 + index * 0.08).toFixed(2)}s">${tl(vx, value, vTextW, valueInk, true)}</g>`);

  const css = `text{font-family:${font.family}}
.sh{animation:shimmer 6s ease-in-out infinite}
.spin{transform-box:view-box;transform-origin:${(vx - statusDot + 4).toFixed(1)}px ${H / 2}px;animation:spin 1.1s linear infinite}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s ease-out infinite}
@keyframes ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
.vseg{transform-box:fill-box;transform-origin:left;animation:growX .6s cubic-bezier(.2,.7,.2,1) ${(0.1 + index * 0.08).toFixed(2)}s both}`;
  const title = b.solo ? b.value : `${b.label}: ${b.value}`;
  return svg({ width: W, height: H, theme: t, title, css, body: `<g class="fade" style="animation-delay:${(index * 0.08).toFixed(2)}s">${parts.join("")}</g>`, fonts: false });
}

export const shields = defineWidget({
  type: "shields",
  title: "Shields",
  description: "Shield-style badges for version, licence, build status, stars, downloads and more, each its own image linking to the right page.",
  scope: "project",
  category: "Identity",
  kind: "svg",
  width: "full",
  fixedHeight: H,
  needs: ["project", "releases", "downloads"],
  defaults: {
    badges: ["version", "license", "ci", "stars", "downloads", "contributors"],
    style: "rounded",
    color: "accent",
    icons: true,
    custom: [],
  },
  fields: [
    { key: "badges", label: "Badges", type: "checklist", options: BADGES },
    {
      key: "style",
      label: "Style",
      type: "segmented",
      help: "Large is shields.io's “for the badge” look: taller, in capitals.",
      options: [
        { value: "flat", label: "Flat" },
        { value: "rounded", label: "Rounded" },
        { value: "outline", label: "Outline" },
        { value: "plastic", label: "Large" },
      ],
    },
    {
      key: "color",
      label: "Value colour",
      type: "segmented",
      help: "Build status always uses green, amber or red.",
      options: [
        { value: "accent", label: "Accent" },
        { value: "neutral", label: "Neutral" },
      ],
    },
    { key: "icons", label: "Icons", type: "toggle" },
    {
      key: "custom",
      label: "Custom badges",
      type: "list",
      itemLabel: "Badge",
      titleKey: "label",
      max: 8,
      newItem: { label: "chat", value: "discord", color: "", link: "", icon: "" },
      item: [
        { key: "label", label: "Label", type: "text", help: "Placeholders like {version} work here." },
        { key: "value", label: "Value", type: "text" },
        { key: "color", label: "Colour", type: "color", allowTheme: true },
        { key: "icon", label: "Icon", type: "icon" },
        { key: "link", label: "Link", type: "text", placeholder: "https://" },
      ],
    },
  ],
  alt: () => "project badges",
  href: (ctx) => repoUrl(ctx),
  parts: (ctx, o) => badgeList(ctx, o).map((b) => ({ key: b.key, alt: b.solo ? b.value : `${b.label}: ${b.value}`, href: b.href })),
  render(ctx, o) {
    const list = badgeList(ctx, o, ctx.date);
    if (!list.length) return renderBadge(ctx, o, { key: "none", label: "badges", value: "none selected", icon: "tag" }, 0);
    return renderBadge(ctx, o, list[0], 0);
  },
  renderPart(ctx, o, key) {
    const list = badgeList(ctx, o, ctx.date);
    const i = Math.max(0, list.findIndex((b) => b.key === key));
    const b = list[i] ?? { key: "none", label: "badges", value: "none selected", icon: "tag" };
    return renderBadge(ctx, o, b, i);
  },
});
