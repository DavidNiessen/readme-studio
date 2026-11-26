import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { encodeGif, fontInfo, type Frame, type GifFrames } from "@readme-studio/core";
import { sfntFonts } from "./fonts";

let ready: Promise<void> | null = null;

function wasmPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = join(here, "index_bg.wasm");
  if (existsSync(bundled)) return bundled;
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve("@resvg/resvg-wasm")), "index_bg.wasm");
}

export function initRaster(): Promise<void> {
  ready ??= initWasm(readFileSync(wasmPath()));
  return ready;
}

/** SVG fonts are named `rs-<id>` inside the SVG; resvg matches by the real family name, so rewrite. */
function forRaster(svg: string, fonts: string[]): string {
  let out = svg.replace(/@font-face\{[^}]*\}/g, "");
  for (const id of fonts) out = out.split(`rs-${id}`).join(`'${fontInfo(id).name}'`);
  return out;
}

/** Rasterise an SVG string to RGBA pixels with the vendored fonts. */
export async function rasterize(svg: string, fonts: string[]): Promise<{ rgba: Uint8Array; width: number; height: number }> {
  await initRaster();
  const r = new Resvg(forRaster(svg, fonts), {
    font: { fontBuffers: sfntFonts(fonts), loadSystemFonts: false, defaultFontFamily: fontInfo(fonts[0] ?? "jetbrains-mono").name },
  });
  const img = r.render();
  const out = { rgba: new Uint8Array(img.pixels), width: img.width, height: img.height };
  free(img, r);
  return out;
}

function free(...xs: unknown[]): void {
  for (const x of xs) (x as { free?: () => void }).free?.();
}

/** Render SVG frames and encode them as a looping GIF. */
export async function framesToGif(g: GifFrames, fonts: string[]): Promise<Uint8Array> {
  let w = g.width;
  let h = g.height;
  const raster: Frame[] = [];
  for (const f of g.frames) {
    const r = await rasterize(f.svg, fonts);
    w = r.width;
    h = r.height;
    raster.push({ rgba: r.rgba, delay: f.delay });
  }
  return encodeGif(w, h, raster);
}

export async function svgToPng(svg: string, fonts: string[]): Promise<Uint8Array> {
  await initRaster();
  const r = new Resvg(forRaster(svg, fonts), { font: { fontBuffers: sfntFonts(fonts), loadSystemFonts: false } });
  const img = r.render();
  const png = img.asPng();
  free(img, r);
  return png;
}
