/**
 * Bundles the action and CLI into self-contained ESM files under dist/
 * (committed, so the GitHub Action runs without `npm install`).
 */
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const require = createRequire(import.meta.url);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "fonts"), { recursive: true });

const banner = `// Readme Studio engine, bundled with esbuild. Source: packages/engine/src. Do not edit.
import { createRequire as __rsCreateRequire } from "node:module";
const require = __rsCreateRequire(import.meta.url);`;

for (const entry of ["action", "cli"]) {
  await build({
    entryPoints: [join(root, "src", `${entry}.ts`)],
    outfile: join(dist, `${entry}.mjs`),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    banner: { js: banner },
    legalComments: "none",
    minify: false,
    sourcemap: false,
    logLevel: "warning",
  });
}

copyFileSync(join(dirname(require.resolve("@resvg/resvg-wasm")), "index_bg.wasm"), join(dist, "index_bg.wasm"));
const fonts = join(root, "../core/assets/fonts");
for (const f of readdirSync(fonts)) if (f.endsWith(".woff") || f.endsWith(".txt")) copyFileSync(join(fonts, f), join(dist, "fonts", f));
console.log("bundled → packages/engine/dist");
