import { esc, groupDigits } from "../lib/escape";
import { card, f, fitText, svg, textWidth } from "../lib/svg";
import type { Contributor } from "../data/types";
import { dl, header, optBool, optNum, optPick, optStr } from "./kit-d";
import { avatar, noRepo, pdata, repoUrl } from "./kit-e";
import { glyph } from "./parts";
import { defineWidget } from "./types";

const W = 840;
const SIZES = { sm: 32, md: 44, lg: 58 } as const;

export const contributorWall = defineWidget({
  type: "contributors",
  title: "Contributor wall",
  description: "Everyone who has committed to the project as a wall of avatars that pop in one by one, top contributors first.",
  scope: "project",
  category: "Identity",
  kind: "svg",
  width: "full",
  needs: ["project", "contributors"],
  defaults: { label: "contributors", max: 30, size: "md", names: true, shape: "circle", sort: "contributions" },
  fields: [
    { key: "label", label: "Label", type: "text" },
    { key: "max", label: "Avatars", type: "number", min: 12, max: 60, step: 1 },
    {
      key: "size",
      label: "Size",
      type: "segmented",
      options: [
        { value: "sm", label: "S" },
        { value: "md", label: "M" },
        { value: "lg", label: "L" },
      ],
    },
    { key: "names", label: "Names", type: "toggle", help: "Login under each avatar." },
    {
      key: "shape",
      label: "Shape",
      type: "segmented",
      options: [
        { value: "circle", label: "Circle" },
        { value: "rounded", label: "Rounded square" },
      ],
    },
    {
      key: "sort",
      label: "Order",
      type: "segmented",
      options: [
        { value: "contributions", label: "Most commits" },
        { value: "alpha", label: "A–Z" },
      ],
    },
  ],
  alt: (ctx) => {
    const pd = pdata(ctx);
    return pd ? `${groupDigits(pd.contributorCount || pd.contributors.length)} contributors to ${pd.fullName}` : "contributors";
  },
  href: (ctx) => `${repoUrl(ctx)}/graphs/contributors`,
  render(ctx, o) {
    const t = ctx.theme;
    const pd = pdata(ctx);
    const lbl = optStr(o.label);
    const top = lbl ? 52 : 24;
    if (!pd) {
      const H = top + 150;
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl) : ""}${noRepo(t, 24, top, W - 48, 126, "Contributor avatars")}`;
      return svg({ width: W, height: H, theme: t, title: "contributors", body });
    }
    const size = SIZES[optPick(o.size, ["sm", "md", "lg"], "md")];
    const names = optBool(o.names, true);
    const shape = optPick(o.shape, ["circle", "rounded"], "circle");
    const max = Math.round(optNum(o.max, 30, 12, 60));
    const all: Contributor[] = (pd.contributors ?? []).filter((c) => c && typeof c.login === "string" && c.login);
    const byCommits = [...all].sort((a, b) => (b.contributions || 0) - (a.contributions || 0));
    const rank = new Map(byCommits.map((c, i) => [c.login, i]));
    const list = optPick(o.sort, ["contributions", "alpha"], "contributions") === "alpha" ? [...all].sort((a, b) => a.login.localeCompare(b.login)) : byCommits;
    const count = Math.max(pd.contributorCount || 0, all.length);
    const commits = all.reduce((a, c) => a + (c.contributions || 0), 0);

    // grid: cells stretch to fill the row exactly
    const areaW = W - 48;
    const minCell = names ? Math.max(size + 14, size <= 32 ? 62 : 74) : size + (size <= 32 ? 8 : 12);
    const cols = Math.max(1, Math.floor(areaW / minCell));
    const more = count > list.length || list.length > max;
    let shown = Math.min(list.length, max);
    // the "+N more" chip takes the last slot
    if (more && shown >= max) shown = max - 1;
    const slots = shown + (more ? 1 : 0);
    const rows = Math.max(1, Math.ceil(slots / cols));
    const cellW = areaW / cols;
    const rowH = size + (names ? 30 : 12);
    const right = `${groupDigits(count)} ${count === 1 ? "contributor" : "contributors"}${commits ? ` · ${groupDigits(commits)} commits` : ""}`;

    if (!slots) {
      const H = top + 120;
      const body = `${card(t, { width: W, height: H })}${lbl ? header(t, W, lbl, right) : ""}
<g class="in" style="${dl(0.2)}"><rect x="24" y="${top}" width="${W - 48}" height="96" rx="${Math.max(4, t.radius - 2)}" fill="${t.raised}" fill-opacity=".5" stroke="${t.border}" stroke-dasharray="4 4"/>
${glyph("users", W / 2 - 9, top + 22, 18, t.subtle)}
<text x="${W / 2}" y="${top + 60}" font-size="13" text-anchor="middle" class="t b">No contributors yet</text>
<text x="${W / 2}" y="${top + 78}" font-size="11" text-anchor="middle" class="m">Commit authors will gather here.</text></g>`;
      return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), body });
    }

    const H = top + rows * rowH + (names ? 8 : 12);
    const r = size / 2;
    const cells: string[] = [];
    for (let i = 0; i < slots; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cx = 24 + (col + 0.5) * cellW;
      const cy = top + row * rowH + r + 4;
      const d0 = 0.25 + Math.min(2.2, (row * cols + col) * (1.6 / Math.max(12, slots)) + row * 0.05);
      if (more && i === slots - 1) {
        const rest = count - shown;
        const txt = `+${rest >= 1000 ? `${Math.round(rest / 100) / 10}k` : rest}`;
        const fs = Math.min(size * 0.34, (size - 8) / Math.max(1, textWidth(t, txt, 1, { bold: true })));
        const box =
          shape === "rounded"
            ? `<rect x="${f(cx - r)}" y="${f(cy - r)}" width="${size}" height="${size}" rx="${f(Math.max(3, r * 0.42))}" fill="${t.raised}" stroke="${t.border}" stroke-dasharray="3 3"/>`
            : `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${t.raised}" stroke="${t.border}" stroke-dasharray="3 3"/>`;
        cells.push(`<g class="fx" style="animation:pop .5s ease ${(d0 + 0.2).toFixed(2)}s both">${box}<text x="${f(cx)}" y="${f(cy + fs * 0.36)}" font-size="${f(fs)}" text-anchor="middle" class="a b">${esc(txt)}</text></g>
${names ? `<text x="${f(cx)}" y="${f(cy + r + 16)}" font-size="10" text-anchor="middle" class="m fade" style="${dl(d0 + 0.3)}">more</text>` : ""}`);
        continue;
      }
      const c = list[i];
      const k = rank.get(c.login) ?? 99;
      const ring = k < 3 ? t.accent : t.border;
      const halo =
        k === 0
          ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r + 3)}" stroke="${t.glow}" stroke-width="1.5" class="fx loop" style="animation:ping 2.6s ease-out 2.6s infinite"/>`
          : "";
      cells.push(`${halo}${avatar(t, c, cx, cy, r, `av${i}`, { shape, ring, ringWidth: k < 3 ? 2 : 1, extra: `class="fx" style="animation:pop .5s ease ${d0.toFixed(2)}s both"` })}
${names ? `<text x="${f(cx)}" y="${f(cy + r + 16)}" font-size="10" text-anchor="middle" class="${k < 3 ? "t" : "m"} fade" style="${dl(d0 + 0.2)}">${esc(fitText(t, c.login, 10, cellW - 8))}</text>` : ""}`);
    }
    const css = `@keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.35);opacity:0}}`;
    const body = `${card(t, { width: W, height: H })}
${lbl ? header(t, W, lbl, right) : ""}
${cells.join("\n")}`;
    return svg({ width: W, height: H, theme: t, title: this.alt(ctx, o), css, body });
  },
});
