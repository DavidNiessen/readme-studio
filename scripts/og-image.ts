/**
 * Renders the link preview image (apps/web/public/og.png, 1200×630) shown when a link to the
 * studio is shared on GitHub, Slack, X and the like. The README card on the right is made of
 * real widgets, rendered by the same code as the action.
 *
 *   npx tsx scripts/og-image.ts
 *
 * Needs Playwright with Chromium (it screenshots the composed page), installed in the repo or
 * globally with NODE_PATH=$(npm root -g). Run it after changing the brand, then commit the PNG.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { blockParts, createCtx, DEFAULT_PROFILE, loadAllFonts, mockData, normalizeConfig, renderPart } from "../packages/core/src/index";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/web/public/og.png");
const work = mkdtempSync(join(tmpdir(), "rs-og-"));

await loadAllFonts();
const date = new Date("2026-11-26T09:00:00Z");
const { config } = normalizeConfig({
  kind: "profile",
  profile: DEFAULT_PROFILE,
  theme: { preset: "crimson", font: "jetbrains-mono", headingFont: "jetbrains-mono" },
  layout: [{ blocks: [{ type: "hero", id: "hero" }] }, { blocks: [{ type: "stats", id: "stats" }] }, { blocks: [{ type: "contrib", id: "contrib" }] }],
});
const data = mockData(date, config.profile.login, config.profile.name, config.profile.location.timezone);
const ctx = createCtx(config, data, "dark", { date, run: "42" });
const imgs: string[] = [];
for (const row of config.layout) {
  for (const b of row.blocks) {
    for (const p of blockParts(b, ctx)) {
      const file = join(work, `${p.name}.svg`);
      writeFileSync(file, renderPart(p, ctx));
      imgs.push(`<img src="${pathToFileURL(file)}" alt="">`);
    }
  }
}

const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => pathToFileURL(join(dirname(require.resolve(`${pkg}/package.json`)), "files", file)).href;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Sans; src: url(${font("@fontsource/instrument-sans", "instrument-sans-latin-600-normal.woff2")}); font-weight: 600; }
@font-face { font-family: Sans; src: url(${font("@fontsource/instrument-sans", "instrument-sans-latin-400-normal.woff2")}); font-weight: 400; }
@font-face { font-family: Serif; src: url(${font("@fontsource/instrument-serif", "instrument-serif-latin-400-italic.woff2")}); font-style: italic; }
@font-face { font-family: Mono; src: url(${font("@fontsource/jetbrains-mono", "jetbrains-mono-latin-500-normal.woff2")}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: #0e0e0d; color: #edebe6; font-family: Sans; position: relative; }
body::before { content: ""; position: absolute; inset: 0; background:
  radial-gradient(600px 420px at 88% 30%, rgba(242,106,69,.22), transparent 70%),
  linear-gradient(rgba(237,235,230,.04) 1px, transparent 1px) 0 0 / 32px 32px,
  linear-gradient(90deg, rgba(237,235,230,.04) 1px, transparent 1px) 0 0 / 32px 32px; }
.copy { position: absolute; left: 72px; top: 76px; width: 520px; }
.mark { width: 72px; height: 72px; }
h1 { margin-top: 34px; font-size: 92px; line-height: .95; font-weight: 600; letter-spacing: -2.5px; }
h1 em { font-family: Serif; font-weight: 400; font-style: italic; letter-spacing: -1px; color: #f26a45; }
p { margin-top: 26px; font-size: 29px; line-height: 1.3; color: #b9b6ae; }
.url { position: absolute; left: 72px; bottom: 64px; font: 22px Mono; color: #f26a45; letter-spacing: .5px; }
.card { position: absolute; left: 650px; top: 70px; width: 640px; padding: 18px; border-radius: 16px; background: #0d1117;
  border: 1px solid #30363d; box-shadow: 0 30px 80px rgba(0,0,0,.55); transform: rotate(-3deg); display: grid; gap: 10px; }
.card .bar { font: 15px Mono; color: #9198a1; padding: 0 4px 6px; border-bottom: 1px solid #30363d; }
.card img { width: 100%; display: block; }
</style>
<div class="copy">
  <svg class="mark" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#edebe6"/><rect x="7" y="8" width="18" height="3" rx="1.5" fill="#0e0e0d"/><rect x="7" y="14.5" width="11" height="3" rx="1.5" fill="#0e0e0d" opacity=".55"/><rect x="7" y="21" width="7" height="3" rx="1.5" fill="#f26a45"/></svg>
  <h1>Readme <em>Studio</em></h1>
  <p>Animated, self-updating GitHub READMEs, designed in the browser.</p>
</div>
<div class="url">readme.niessen.dev</div>
<div class="card"><div class="bar">README.md</div>${imgs.join("")}</div>`;
const page = join(work, "og.html");
writeFileSync(page, html);

// loaded with require so a global install works too (NODE_PATH=$(npm root -g))
const { chromium } = require("playwright") as typeof import("playwright");
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await tab.goto(pathToFileURL(page).href);
// let the widgets' entrance animations finish
await tab.waitForTimeout(4000);
await tab.screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
