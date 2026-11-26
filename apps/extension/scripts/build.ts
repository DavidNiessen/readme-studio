/**
 * Builds the extension for Chrome and Firefox:
 *
 *   dist/common            pages (studio, options), content and background scripts, icons
 *   dist/chrome|firefox    common + that browser's manifest.json
 *   dist/readme-studio-<browser>-<version>.zip
 *
 * The version comes from RS_VERSION (set by the release workflows) or the root package.json.
 * VITE_GITHUB_CLIENT_ID, when set, ships an OAuth App client ID for "Sign in with GitHub".
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { zipSync } from "fflate";
import { build, createLogger } from "vite";
import { buildManifest, type Browser } from "../src/manifest";

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
const src = join(app, "src");
const dist = join(app, "dist");
const common = join(dist, "common");
const require = createRequire(import.meta.url);

const version = process.env.RS_VERSION || (JSON.parse(readFileSync(resolve(app, "../../package.json"), "utf8")) as { version: string }).version;

// theme.js is a classic script on purpose (it must run before the page paints); Vite's note about
// it not being bundled is expected, everything else still shows
const logger = createLogger("warn");
const warn = logger.warn;
logger.warn = (msg, options) => {
  if (!msg.includes('src="./theme.js"')) warn(msg, options);
};
const quiet = { logLevel: "warn" as const, configFile: false as const, customLogger: logger };

async function pages() {
  await build({
    ...quiet,
    root: src,
    base: "./",
    plugins: [react()],
    envDir: app,
    build: {
      outDir: common,
      emptyOutDir: true,
      target: "es2022",
      chunkSizeWarningLimit: 4000,
      assetsDir: "assets",
      rollupOptions: { input: { studio: join(src, "studio.html"), options: join(src, "options.html") } },
    },
  });
}

/** Content and background scripts are classic scripts: one self-contained file each. */
async function script(name: "content" | "background", entry: string) {
  await build({
    ...quiet,
    envDir: app,
    build: {
      outDir: common,
      emptyOutDir: false,
      target: "es2022",
      minify: true,
      lib: { entry, formats: ["iife"], name: `readmeStudio_${name}`, fileName: () => `${name}.js` },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
}

/** The studio's logo mark as PNG icons, drawn from the same shapes as the website's LogoMark. */
async function icons() {
  await initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1b1a17"/><rect x="7" y="8" width="18" height="3" rx="1.5" fill="#fbfaf7"/><rect x="7" y="14.5" width="11" height="3" rx="1.5" fill="#fbfaf7" opacity=".55"/><rect x="7" y="21" width="7" height="3" rx="1.5" fill="#e5532d"/></svg>`;
  mkdirSync(join(common, "icons"), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
    writeFileSync(join(common, "icons", `${size}.png`), png);
  }
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

function pack(browser: Browser) {
  const out = join(dist, browser);
  rmSync(out, { recursive: true, force: true });
  cpSync(common, out, { recursive: true });
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify(buildManifest(browser, version), null, 2)}\n`);
  const entries: Record<string, Uint8Array> = {};
  for (const f of files(out)) entries[relative(out, f).split("\\").join("/")] = readFileSync(f);
  const zip = join(dist, `readme-studio-${browser}-${version}.zip`);
  writeFileSync(zip, zipSync(entries, { level: 9 }));
  console.log(`${browser}: ${relative(app, zip)} (${(statSync(zip).size / 1024).toFixed(0)} KB)`);
}

rmSync(dist, { recursive: true, force: true });
await pages();
await script("content", join(src, "content/github.ts"));
await script("background", join(src, "background.ts"));
await icons();
for (const b of ["chrome", "firefox"] as const) pack(b);
