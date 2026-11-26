import { strToU8, zipSync, type Zippable } from "fflate";
import {
  assetFileName,
  createCtx,
  encodeGif,
  layoutParts,
  loadFonts,
  renderFrames,
  renderPart,
  renderReadme,
  serializeConfig,
  setupGuide,
  WORKFLOW_FILE,
  workflowYaml,
  type Frame,
  type GifFrames,
  type ProfileData,
  type StudioConfig,
} from "@readme-studio/core";

export interface ProjectFile {
  path: string;
  content: string;
  description: string;
}

export function projectFiles(config: StudioConfig, data: ProfileData, opts: { profileToken: boolean }): ProjectFile[] {
  return [
    { path: "readme.config.json", content: `${serializeConfig(config)}`, description: "Your design. Import it in the studio to keep editing." },
    { path: WORKFLOW_FILE, content: workflowYaml(config, { profileToken: opts.profileToken }), description: "Runs the action on a schedule." },
    { path: "README.md", content: renderReadme(config, data), description: "The generated layout (the action keeps it up to date)." },
    { path: "SETUP.md", content: setupGuide(config), description: "Step-by-step setup instructions." },
  ];
}

export function download(name: string, bytes: Uint8Array | string, type = "application/octet-stream"): void {
  const blob = new Blob([typeof bytes === "string" ? bytes : (bytes as BlobPart)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function projectZip(config: StudioConfig, data: ProfileData, opts: { profileToken: boolean }): Uint8Array {
  const files: Zippable = {};
  const root = `${config.profile.login}-readme`;
  for (const f of projectFiles(config, data, opts)) files[`${root}/${f.path}`] = strToU8(f.content);
  return zipSync(files, { level: 6 });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("frame failed to load"));
    im.src = url;
  });
}

/** Rasterise SVG frames with the browser and encode them as a GIF. */
export async function framesToGifBrowser(g: GifFrames): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const out: Frame[] = [];
  for (const f of g.frames) {
    const url = URL.createObjectURL(new Blob([f.svg], { type: "image/svg+xml" }));
    try {
      const im = await loadImage(url);
      ctx.clearRect(0, 0, g.width, g.height);
      ctx.drawImage(im, 0, 0, g.width, g.height);
      out.push({ rgba: new Uint8Array(ctx.getImageData(0, 0, g.width, g.height).data.buffer), delay: f.delay });
    } finally {
      URL.revokeObjectURL(url);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  return encodeGif(g.width, g.height, out);
}

/** Every asset rendered in the browser, plus a README that references them relatively. */
export async function assetsZip(config: StudioConfig, data: ProfileData, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  await loadFonts([config.theme.font, config.theme.headingFont]);
  const files: Zippable = {};
  const parts = layoutParts(config, data)
    .flat()
    .filter((p) => p.kind !== "markdown");
  const total = parts.length * config.output.modes.length;
  let done = 0;
  for (const mode of config.output.modes) {
    const ctx = createCtx(config, data, mode);
    for (const p of parts) {
      const name = `assets/${assetFileName(p.name, mode, p.kind)}`;
      files[name] = p.kind === "gif" ? await framesToGifBrowser(renderFrames(p, ctx)) : strToU8(renderPart(p, ctx));
      onProgress?.(++done, total);
    }
  }
  files["README.md"] = strToU8(renderReadme(config, data, { assetBase: "./assets", banner: false }));
  return zipSync(files, { level: 6 });
}
