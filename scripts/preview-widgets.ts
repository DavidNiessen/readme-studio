/**
 * Dev helper: renders every widget with mock data into an HTML contact sheet.
 *   npx tsx scripts/preview-widgets.ts <outDir> [preset] [mode] [font] [kind: profile|project|all]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCtx, loadAllFonts, mockData, normalizeConfig, renderPart, blockParts, widgetList, widgetFits, DEFAULT_PROFILE } from "../packages/core/src/index";

const [out = "preview", preset = "crimson", mode = "dark", font = "jetbrains-mono", kind = "all"] = process.argv.slice(2);
await loadAllFonts();
mkdirSync(out, { recursive: true });
const { config } = normalizeConfig({
  kind: kind === "project" ? "project" : "profile",
  profile: DEFAULT_PROFILE,
  project: { repo: "octocat/aurora", tagline: "A tiny, fast design-token compiler for multi-brand UI kits.", packages: { npm: "aurora" } },
  theme: { preset, font, headingFont: font },
  layout: [{ blocks: widgetList.filter((w) => kind === "all" || widgetFits(w, kind as "profile" | "project")).map((w) => ({ type: w.type, id: w.type })) }],
});
const data = mockData(new Date("2026-11-26T09:00:00Z"), config.profile.login, config.profile.name, config.profile.location.timezone);
const ctx = createCtx(config, data, mode as "dark" | "light", { date: new Date("2026-11-26T09:00:00Z"), run: "42" });
const imgs: string[] = [];
for (const b of config.layout[0].blocks) {
  for (const p of blockParts(b, ctx)) {
    const s = renderPart(p, ctx);
    if (p.kind === "markdown") {
      imgs.push(`<pre style="color:#888;width:840px;white-space:pre-wrap">${s.replace(/</g, "&lt;")}</pre>`);
      continue;
    }
    const file = `${p.name}.svg`;
    writeFileSync(join(out, file), s);
    const w = p.def.width === "half" ? 415 : p.def.width === "third" ? 272 : 840;
    imgs.push(`<figure style="margin:0"><img src="${file}" style="${p.fixedHeight ? `height:${p.fixedHeight}px` : `width:${w}px`}"><figcaption style="font:11px monospace;color:#888">${p.name} (${(s.length / 1024).toFixed(1)} KB)</figcaption></figure>`);
  }
}
const bg = ctx.theme.name === "dark" ? "#0d1117" : "#ffffff";
writeFileSync(join(out, "index.html"), `<!doctype html><body style="background:${bg};margin:0;padding:20px;display:flex;flex-wrap:wrap;gap:12px;width:1720px;align-items:flex-start">${imgs.join("")}</body>`);
console.log(`${imgs.length} images → ${out}/index.html`);
