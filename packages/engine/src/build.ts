import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  allBlocks,
  assetFileName,
  createCtx,
  fetchProfileData,
  getWidget,
  layoutParts,
  loadFonts,
  mockData,
  renderFrames,
  renderPart,
  renderReadme,
  type ProfileData,
  type StudioConfig,
} from "@readme-studio/core";
import { framesToGif } from "./raster";
import { scrapeCalendar, scrapePinned } from "./scrape";

export const LIMITS = { svg: 1.5 * 1024 * 1024, gif: 5 * 1024 * 1024 };

export interface BuildOptions {
  config: StudioConfig;
  outDir: string;
  mock?: boolean;
  /** only render these block ids */
  only?: string[];
  now?: Date;
  /** GitHub Actions run number */
  run?: string | null;
  /** token for GraphQL (PROFILE_TOKEN or GITHUB_TOKEN) */
  token?: string;
  /** data to use instead of fetching (tests) */
  data?: ProfileData;
  /** asset base URL override for README links */
  assetBase?: string;
  log?: (msg: string) => void;
}

export interface BuiltAsset {
  file: string;
  bytes: number;
  ms: number;
}

export interface BuildResult {
  data: ProfileData;
  assets: BuiltAsset[];
  readme: string;
  errors: string[];
}

/** Collect the data sources the layout actually needs. */
export function dataNeeds(config: StudioConfig): { weather: boolean; events: boolean; hours: boolean; releases: boolean; feeds: string[] } {
  const needs = new Set<string>();
  const feeds = new Set<string>();
  for (const b of allBlocks(config)) {
    if (b.hidden) continue;
    for (const n of getWidget(b.type)?.needs ?? []) needs.add(n);
    for (const [k, v] of Object.entries(b.options)) if ((k === "feed" || k === "feedUrl") && typeof v === "string" && /^https?:\/\//.test(v)) feeds.add(v);
  }
  return { weather: needs.has("weather"), events: needs.has("events"), hours: needs.has("hours"), releases: needs.has("releases"), feeds: [...feeds] };
}

export async function loadData(o: Pick<BuildOptions, "config" | "mock" | "now" | "token" | "log">): Promise<ProfileData> {
  const now = o.now ?? new Date();
  const p = o.config.profile;
  if (o.mock) return mockData(now, p.login, p.name, p.location.timezone);
  const needs = dataNeeds(o.config);
  return fetchProfileData({
    login: p.login,
    token: o.token,
    timeZone: p.location.timezone,
    location: { latitude: p.location.latitude, longitude: p.location.longitude },
    feeds: needs.feeds,
    include: needs,
    now,
    log: o.log,
    calendar: scrapeCalendar,
    pinned: scrapePinned,
  });
}

/** Render every asset of a config into `outDir`, plus README.md, data.json and preview.html. */
export async function build(o: BuildOptions): Promise<BuildResult> {
  const log = o.log ?? (() => {});
  const now = o.now ?? new Date();
  const { config } = o;
  await loadFonts([config.theme.font, config.theme.headingFont]);
  const data = o.data ?? (await loadData({ ...o, now }));
  log(`data source: ${data.source}, ${data.weeks.length} weeks, ${data.lastYearTotal} contributions in the last year`);
  if (!o.only) rmSync(o.outDir, { recursive: true, force: true });
  mkdirSync(o.outDir, { recursive: true });
  writeFileSync(join(o.outDir, "data.json"), JSON.stringify(data, null, 2));
  const errors: string[] = [];
  const assets: BuiltAsset[] = [];
  const fonts = [config.theme.font, config.theme.headingFont];
  const rows = layoutParts(config, data);
  for (const mode of config.output.modes) {
    const ctx = createCtx(config, data, mode, { date: now, run: o.run ?? null });
    for (const part of rows.flat()) {
      if (part.kind === "markdown") continue;
      if (o.only && !o.only.includes(part.block.id)) continue;
      const file = assetFileName(part.name, mode, part.kind);
      const started = performance.now();
      try {
        if (part.kind === "gif") writeFileSync(join(o.outDir, file), await framesToGif(renderFrames(part, ctx), fonts));
        else writeFileSync(join(o.outDir, file), renderPart(part, ctx));
      } catch (e) {
        errors.push(`${file}: ${(e as Error).message}`);
        continue;
      }
      const bytes = statSync(join(o.outDir, file)).size;
      const ms = performance.now() - started;
      assets.push({ file, bytes, ms });
      log(`  ${file.padEnd(40)} ${(bytes / 1024).toFixed(1).padStart(8)} KB ${ms.toFixed(0).padStart(6)} ms`);
      const limit = part.kind === "gif" ? LIMITS.gif : LIMITS.svg;
      if (bytes > limit) errors.push(`${file} is ${(bytes / 1024 / 1024).toFixed(2)} MB (limit ${limit / 1024 / 1024} MB)`);
    }
  }
  const readme = renderReadme(config, data, { assetBase: o.assetBase, date: now });
  writeFileSync(join(o.outDir, "README.md"), readme);
  writeFileSync(join(o.outDir, "preview.html"), previewHtml(config, data, now));
  return { data, assets, readme, errors };
}

/** A local page that shows the README layout with the freshly built files in both schemes. */
export function previewHtml(config: StudioConfig, data: ProfileData, now: Date): string {
  const pages = config.output.modes.map((mode) => {
    const readme = renderReadme(config, data, { assetBase: ".", modes: [mode], banner: false, date: now })
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<p align="(\w+)">/g, '<p style="text-align:$1">');
    const bg = mode === "dark" ? "#0d1117" : "#ffffff";
    const fg = mode === "dark" ? "#f0f6fc" : "#1f2328";
    return `<section style="background:${bg};color:${fg};padding:32px;border-radius:12px;max-width:896px;margin:24px auto;font:16px -apple-system,Segoe UI,sans-serif">${readme}</section>`;
  });
  return `<!doctype html><meta charset="utf-8"><title>README preview</title><style>body{background:#888;margin:0}img{max-width:100%}</style>${pages.join("")}`;
}
